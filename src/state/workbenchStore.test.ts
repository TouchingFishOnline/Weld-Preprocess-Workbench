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
  it("starts without sample-specific weld stages", () => {
    const store = createWorkbenchStore();

    expect(store.getState().stages).toEqual([]);
    expect(store.getState().activeStageId).toBeNull();
  });

  it("creates operator-defined weld stages", () => {
    const store = createWorkbenchStore();

    store.getState().addStage();

    expect(store.getState().stages).toEqual([
      { id: "stage-01", name: "阶段 1", color: "#2563eb", seamIds: [] }
    ]);
    expect(store.getState().activeStageId).toBe("stage-01");
  });

  it("toggles view lock state", () => {
    const store = createWorkbenchStore();

    store.getState().toggleViewLocked();

    expect(store.getState().viewLocked).toBe(true);

    store.getState().toggleViewLocked();

    expect(store.getState().viewLocked).toBe(false);
  });

  it("toggles candidate group highlight and clears it when changing filters", () => {
    const store = createWorkbenchStore();

    store.getState().toggleCandidateGroupHighlight();

    expect(store.getState().candidateGroupHighlighted).toBe(true);

    store.getState().setCandidateKindFilter("linear-body-seam");

    expect(store.getState().candidateKindFilter).toBe("linear-body-seam");
    expect(store.getState().candidateGroupHighlighted).toBe(false);
  });

  it("creates a seam from the selected candidates and assigns it to the active stage", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().addStage();
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
    store.getState().addStage();
    store.getState().addStage();

    store.getState().setActiveStage("stage-02");

    expect(store.getState().activeStageId).toBe("stage-02");
  });

  it("deletes a stage and its assigned seams", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().addStage();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();

    store.getState().deleteStage("stage-01");

    expect(store.getState().stages).toEqual([]);
    expect(store.getState().seams).toEqual([]);
    expect(store.getState().activeStageId).toBeNull();
    expect(store.getState().activeSeamId).toBeNull();
  });

  it("deletes a seam from the active stage", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().addStage();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();

    store.getState().deleteSeam("seam-01");

    expect(store.getState().seams).toEqual([]);
    expect(store.getState().stages[0].seamIds).toEqual([]);
    expect(store.getState().activeSeamId).toBeNull();
  });

  it("moves seams within a stage order", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().addStage();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();

    store.getState().moveSeamInStage("stage-01", "seam-02", -1);

    expect(store.getState().stages[0].seamIds).toEqual(["seam-02", "seam-01"]);
  });

  it("reorders seams to an explicit stage position", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().addStage();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();

    store.getState().reorderSeamInStage("stage-01", "seam-03", 0);

    expect(store.getState().stages[0].seamIds).toEqual(["seam-03", "seam-01", "seam-02"]);
  });

  it("saves and applies default laser pose definitions", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    store.getState().updatePoseDefinition({ workAngleDeg: 62, travelAngleDeg: -12 });
    store.getState().saveCurrentPoseAsDefault();
    store.getState().addStage();
    store.getState().toggleCandidate("edge_1");
    store.getState().confirmSelectionAsSeam();

    expect(store.getState().defaultPoseDefinition.workAngleDeg).toBe(62);
    expect(store.getState().seams[0].poseDefinition?.workAngleDeg).toBe(62);

    store.getState().updatePoseDefinition({ workAngleDeg: 15 });
    expect(store.getState().seams[0].poseDefinition?.workAngleDeg).toBe(15);

    store.getState().applyDefaultPoseToActiveSeam();
    expect(store.getState().seams[0].poseDefinition?.workAngleDeg).toBe(62);
  });

  it("loads candidates from a workpiece manifest", () => {
    const store = createWorkbenchStore();

    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");

    expect(store.getState().workpiece?.sourceFile).toBe("part.step");
    expect(store.getState().workpieceBaseUrl).toBe("/workpieces/wp");
    expect(store.getState().candidates.map((candidate) => candidate.id)).toEqual(["edge_1"]);
  });

  it("loads semantic seam candidates while keeping raw edge fallback candidates", () => {
    const store = createWorkbenchStore();

    store.getState().loadWorkpieceManifest(
      {
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
      },
      "/workpieces/wp/manifest.json"
    );

    expect(store.getState().candidates.map((candidate) => candidate.id)).toEqual(["seam_candidate_001", "raw-edge:edge_1"]);
  });

  it("exports and restores operator annotations for the same STEP hash", () => {
    const sourceStore = createWorkbenchStore();
    sourceStore.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    sourceStore.getState().addStage();
    sourceStore.getState().setTargetShape("edge");
    sourceStore.getState().updatePoseDefinition({ workAngleDeg: 45, travelAngleDeg: -35 });
    sourceStore.getState().toggleCandidate("edge_1");
    sourceStore.getState().confirmSelectionAsSeam();

    const project = sourceStore.getState().exportProject();

    expect(project?.workpiece.sourceHash).toBe("abc");
    expect(project?.plan.seams).toHaveLength(1);
    expect(project?.plan.stages[0].seamIds).toEqual(["seam-01"]);

    const targetStore = createWorkbenchStore();
    targetStore.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");

    expect(targetStore.getState().importProject(project)).toEqual({ ok: true });
    expect(targetStore.getState().targetShape).toBe("edge");
    expect(targetStore.getState().activeSeamId).toBe("seam-01");
    expect(targetStore.getState().poseDefinition.workAngleDeg).toBe(45);
    expect(targetStore.getState().poseDefinition.travelAngleDeg).toBe(-35);
    expect(targetStore.getState().stages[0].seamIds).toEqual(["seam-01"]);
  });

  it("rejects annotation imports that do not match the loaded STEP hash", () => {
    const sourceStore = createWorkbenchStore();
    sourceStore.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    const project = sourceStore.getState().exportProject();

    const otherManifest: WorkpieceManifest = {
      ...manifest,
      id: "other",
      sourceFile: "other.step",
      sourceHash: "different"
    };
    const targetStore = createWorkbenchStore();
    targetStore.getState().loadWorkpieceManifest(otherManifest, "/workpieces/other/manifest.json");
    targetStore.getState().addStage();

    const result = targetStore.getState().importProject(project);

    expect(result).toEqual({
      ok: false,
      reason: "hash-mismatch",
      message: "标注文件不属于当前 STEP，请先加载对应 STEP。"
    });
    expect(targetStore.getState().stages).toHaveLength(1);
    expect(targetStore.getState().seams).toEqual([]);
  });

  it("rejects unsupported annotation file versions", () => {
    const store = createWorkbenchStore();
    store.getState().loadWorkpieceManifest(manifest, "/workpieces/wp/manifest.json");
    const project = store.getState().exportProject();

    const result = store.getState().importProject({ ...project, version: 99 });

    expect(result).toEqual({
      ok: false,
      reason: "unsupported-version",
      message: "标注文件版本不受支持。"
    });
  });
});
