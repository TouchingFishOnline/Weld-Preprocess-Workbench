import { describe, expect, it } from "vitest";
import { edgeToCandidate, transformPoint } from "./workpiece";
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

  it("converts circular manifest edges into circle candidates", () => {
    const candidate = edgeToCandidate(manifest.edges[0]);

    expect(candidate?.shape).toBe("circle");
    expect(candidate?.id).toBe("edge_1");
    expect(candidate?.shape === "circle" ? candidate.radiusMm : undefined).toBe(12.5);
  });
});
