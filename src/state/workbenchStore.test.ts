import { describe, expect, it } from "vitest";
import { createWorkbenchStore } from "./workbenchStore";
import type { WorkpieceManifest } from "../domain/workpieceTypes";

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
    center: [50, 10, 10],
    scale: 0.1
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

describe("workbench store", () => {
  it("creates a seam from the selected candidates and assigns it to the active stage", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    const firstCandidate = store.getState().candidates[0];

    store.getState().toggleCandidate(firstCandidate.id);
    store.getState().confirmSelectionAsSeam();

    const state = store.getState();
    const createdSeam = state.seams[0];

    expect(createdSeam.segments[0].candidateId).toBe(firstCandidate.id);
    expect(state.stages[0].seamIds).toEqual([createdSeam.id]);
    expect(state.selectedCandidateIds).toEqual([]);
  });

  it("switches the active stage", () => {
    const store = createWorkbenchStore();

    store.getState().setActiveStage("stage-right");

    expect(store.getState().activeStageId).toBe("stage-right");
  });

  it("loads candidates from a workpiece manifest", () => {
    const store = createWorkbenchStore();

    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");

    expect(store.getState().workpiece?.sourceFile).toBe("part.step");
    expect(store.getState().workpieceBaseUrl).toBe("/workpieces/wp");
    expect(store.getState().candidates.map((candidate) => candidate.id)).toEqual(["edge_1"]);
  });
});
