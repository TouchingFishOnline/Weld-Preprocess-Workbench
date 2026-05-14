import tempfile
import unittest
from asyncio import run
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import backend.app as app_module


class WorkpieceApiTest(unittest.TestCase):
    def test_upload_forwards_preprocess_flag_to_step_pipeline(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            uploads = root / "uploads"
            public_workpieces = root / "public" / "workpieces"

            def fake_preprocess_step(source_path, output_dir, *, workpiece_id, include_seam_candidates, **_kwargs):
                self.assertEqual(Path(source_path).name, "example.step")
                self.assertEqual(Path(output_dir), public_workpieces / "example")
                self.assertEqual(workpiece_id, "example")
                self.assertTrue(include_seam_candidates)
                return {
                    "id": workpiece_id,
                    "sourceFile": "example.step",
                    "sourceHash": "hash",
                    "modelUrl": "model.glb",
                    "stepUrl": "example.step",
                    "seamCandidateUrl": "seam-candidates.json",
                    "units": "mm",
                    "bbox": {"min": [0, 0, 0], "max": [1, 1, 1], "center": [0.5, 0.5, 0.5], "size": [1, 1, 1]},
                    "displayTransform": {"center": [0.5, 0.5, -0.5], "scale": 1, "cadToScene": "x,z,-y"},
                    "edges": [],
                    "faces": [],
                    "seamCandidates": [],
                }

            with (
                patch.object(app_module, "UPLOADS", uploads),
                patch.object(app_module, "PUBLIC_WORKPIECES", public_workpieces),
                patch.object(app_module, "preprocess_step", side_effect=fake_preprocess_step),
            ):
                upload = app_module.UploadFile(filename="example.step", file=BytesIO(b"ISO-10303-21;"))
                response = run(app_module.create_workpiece(file=upload, preprocess=True))

            self.assertEqual(response["manifestUrl"], "/workpieces/example/manifest.json")
            self.assertTrue((uploads / "example" / "example.step").exists())


if __name__ == "__main__":
    unittest.main()
