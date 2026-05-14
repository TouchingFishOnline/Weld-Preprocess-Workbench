import json
import tempfile
import unittest
from pathlib import Path

from backend.preprocess import preprocess_step


class PreprocessStepTest(unittest.TestCase):
    def test_generates_glb_manifest_and_circular_edges(self):
        source = Path(__file__).resolve().parents[2] / "manifold-combined.STEP"

        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "workpiece"
            manifest = preprocess_step(source, output_dir, workpiece_id="test-manifold")

            self.assertEqual(manifest["id"], "test-manifold")
            self.assertEqual(manifest["sourceFile"], "manifold-combined.STEP")
            self.assertTrue((output_dir / "model.glb").exists())
            self.assertGreater((output_dir / "model.glb").stat().st_size, 100_000)
            self.assertTrue((output_dir / "manifest.json").exists())

            saved_manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_manifest["modelUrl"], "model.glb")
            self.assertIn("displayTransform", saved_manifest)
            self.assertIn("bbox", saved_manifest)

            circular_edges = [edge for edge in saved_manifest["edges"] if edge["type"] == "circle"]
            self.assertGreaterEqual(len(circular_edges), 30)
            self.assertTrue(any(abs(edge["radiusMm"] - 12.5) < 0.1 for edge in circular_edges))
            self.assertTrue(all(len(edge["polyline"]) >= 8 for edge in circular_edges[:10]))

            self.assertEqual(saved_manifest["seamCandidateUrl"], "seam-candidates.json")
            seam_candidate_path = output_dir / "seam-candidates.json"
            self.assertTrue(seam_candidate_path.exists())
            seam_candidates = json.loads(seam_candidate_path.read_text(encoding="utf-8"))["candidates"]

            nozzle_root_candidates = [
                candidate for candidate in seam_candidates if candidate["kind"] == "nozzle-root-circular"
            ]
            self.assertGreaterEqual(len(nozzle_root_candidates), 20)
            self.assertLess(len(nozzle_root_candidates), len(circular_edges) / 10)
            self.assertTrue(all(candidate["sourceEdgeIds"] for candidate in nozzle_root_candidates))
            self.assertTrue(all(candidate["closed"] for candidate in nozzle_root_candidates))
            self.assertTrue(any(abs(candidate["diameterMm"] - 22.5) < 0.2 for candidate in nozzle_root_candidates))
            self.assertTrue(all(len(candidate["polyline"]) >= 32 for candidate in nozzle_root_candidates[:5]))


if __name__ == "__main__":
    unittest.main()
