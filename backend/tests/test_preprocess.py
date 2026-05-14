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

            self.assertTrue(any(len(edge.get("adjacentFaceIds", [])) >= 1 for edge in saved_manifest["edges"]))
            self.assertTrue(any(len(edge.get("adjacentFaceIds", [])) >= 2 for edge in saved_manifest["edges"]))

            plane_faces = [face for face in saved_manifest["faces"] if face["type"] == "plane"]
            cylinder_faces = [face for face in saved_manifest["faces"] if face["type"] == "cylinder"]
            cone_faces = [face for face in saved_manifest["faces"] if face["type"] == "cone"]
            torus_faces = [face for face in saved_manifest["faces"] if face["type"] == "torus"]
            self.assertTrue(plane_faces)
            self.assertTrue(cylinder_faces)
            self.assertTrue(cone_faces)
            self.assertTrue(torus_faces)
            self.assertTrue(all("normal" in face for face in plane_faces[:5]))
            self.assertTrue(all("axis" in face and "radiusMm" in face for face in cylinder_faces[:5]))
            self.assertTrue(all("axis" in face for face in cone_faces[:5]))
            self.assertTrue(all("axis" in face and "majorRadiusMm" in face for face in torus_faces[:5]))

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

            candidate_kinds = {candidate["kind"] for candidate in seam_candidates}
            self.assertIn("nozzle-root-circular", candidate_kinds)
            self.assertIn("side-fitting-circular", candidate_kinds)
            self.assertIn("end-cap-circular", candidate_kinds)
            self.assertIn("unknown-round-edge-group", candidate_kinds)
            self.assertTrue(all(candidate.get("adjacentFaceIds") for candidate in seam_candidates[:20]))
            self.assertTrue(all("frame" in candidate for candidate in seam_candidates[:20]))
            self.assertTrue(all("tangent" in candidate["frame"] for candidate in seam_candidates[:20]))
            self.assertTrue(all("referenceNormal" in candidate["frame"] for candidate in seam_candidates[:20]))
            self.assertTrue(all("adjacentNormals" in candidate["frame"] for candidate in seam_candidates[:20]))

    def test_can_skip_semantic_seam_candidate_generation(self):
        source = Path(__file__).resolve().parents[2] / "manifold-combined.STEP"

        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "workpiece"
            manifest = preprocess_step(source, output_dir, workpiece_id="test-manifold", include_seam_candidates=False)

            self.assertNotIn("seamCandidateUrl", manifest)
            self.assertNotIn("seamCandidates", manifest)
            self.assertTrue((output_dir / "model.glb").exists())
            self.assertTrue((output_dir / "manifest.json").exists())
            self.assertTrue((output_dir / "manifold-combined.STEP").exists())
            self.assertFalse((output_dir / "seam-candidates.json").exists())

            saved_manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertNotIn("seamCandidateUrl", saved_manifest)
            self.assertNotIn("seamCandidates", saved_manifest)


if __name__ == "__main__":
    unittest.main()
