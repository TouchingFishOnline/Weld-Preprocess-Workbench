import { describe, expect, it } from "vitest";
import { edgeToCandidate, manifestToCandidates, transformDirection, transformPoint } from "./workpiece";
import type { WorkpieceManifest } from "./workpieceTypes";

const manifest: WorkpieceManifest = {
  id: "wp",
  sourceFile: "part.step",
  sourceHash: "abc",
  units: "mm",
  modelUrl: "model.glb",
  stepUrl: "part.step",
  bbox: {
    min: [0, 0, 0],
    max: [100, 20, 20],
    center: [50, 10, 10],
    size: [100, 20, 20]
  },
  displayTransform: {
    center: [50, 10, -10],
    scale: 0.1,
    cadToScene: "x,z,-y"
  },
  edges: [
    {
      id: "edge_1",
      type: "circle",
      closed: true,
      radiusMm: 12.5,
      diameterMm: 25,
      center: [60, 10, 20],
      normal: [0, 0, 1],
      lengthMm: 78.5,
      polyline: [
        [72.5, 10, 20],
        [60, 22.5, 20]
      ]
    }
  ],
  faces: []
};

describe("workpiece manifest adapters", () => {
  it("transforms CAD points into scene points with the manifest display transform", () => {
    expect(transformPoint([60, 10, 20], manifest.displayTransform)).toEqual([1, 1, 0]);
  });

  it("transforms CAD direction vectors into scene direction vectors without scale or translation", () => {
    expect(transformDirection([0, 0, 1], manifest.displayTransform)).toEqual([0, 1, 0]);
    expect(transformDirection([0, 1, 0], manifest.displayTransform)).toEqual([0, 0, -1]);
  });

  it("converts circular manifest edges into circle candidates", () => {
    const candidate = edgeToCandidate(manifest.edges[0]);

    expect(candidate?.shape).toBe("circle");
    expect(candidate?.id).toBe("edge_1");
    expect(candidate?.shape === "circle" ? candidate.radiusMm : undefined).toBe(12.5);
  });

  it("prefers semantic seam candidates over raw edges when present", () => {
    const candidates = manifestToCandidates({
      ...manifest,
      seamCandidateUrl: "seam-candidates.json",
      seamCandidates: [
        {
          id: "seam_candidate_001",
          kind: "nozzle-root-circular",
          shape: "circle",
          label: "Nozzle root 001",
          sourceEdgeIds: ["edge_1"],
          radiusMm: 12.5,
          diameterMm: 25,
          center: [60, 10, 20],
          normal: [0, 0, 1],
          closed: true,
          confidence: 0.82,
          polyline: [
            [72.5, 10, 20],
            [60, 22.5, 20],
            [47.5, 10, 20]
          ]
        }
      ]
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual(["seam_candidate_001"]);
    expect(candidates[0].label).toBe("Nozzle root 001");
  });
});
