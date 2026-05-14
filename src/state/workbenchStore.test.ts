import { describe, expect, it } from "vitest";
import { createWorkbenchStore } from "./workbenchStore";

describe("workbench store", () => {
  it("creates a seam from the selected candidates and assigns it to the active stage", () => {
    const store = createWorkbenchStore();
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
});
