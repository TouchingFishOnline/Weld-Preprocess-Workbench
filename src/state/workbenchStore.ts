import { create } from "zustand";
import { createStore } from "zustand/vanilla";
import { buildSeamFromCandidates } from "../domain/geometry";
import { manifestEdgesToCandidates } from "../domain/workpiece";
import type {
  GeometryCandidate,
  LaserPoseDefinition,
  TargetShape,
  WeldSeam,
  WeldStage
} from "../domain/types";
import type { StateCreator } from "zustand";
import type { WorkpieceManifest } from "../domain/workpieceTypes";

export interface WorkbenchState {
  targetShape: TargetShape;
  workpiece: WorkpieceManifest | null;
  workpieceBaseUrl: string | null;
  candidates: GeometryCandidate[];
  selectedCandidateIds: string[];
  hoverCandidateId: string | null;
  stages: WeldStage[];
  activeStageId: string;
  seams: WeldSeam[];
  activeSeamId: string | null;
  poseDefinition: LaserPoseDefinition;
  sameDiameterSourceId: string | null;
  loadWorkpieceManifest: (manifest: WorkpieceManifest, manifestUrl: string) => void;
  setTargetShape: (targetShape: TargetShape) => void;
  setActiveStage: (stageId: string) => void;
  setHoverCandidate: (candidateId: string | null) => void;
  toggleCandidate: (candidateId: string) => void;
  clearSelection: () => void;
  confirmSelectionAsSeam: () => void;
  setActiveSeam: (seamId: string | null) => void;
  updatePoseDefinition: (patch: Partial<LaserPoseDefinition>) => void;
  setSameDiameterSource: (candidateId: string | null) => void;
}

const initialStages: WeldStage[] = [
  { id: "stage-middle", name: "中部水嘴", color: "#22c55e", seamIds: [] },
  { id: "stage-left", name: "左端旋转焊", color: "#f59e0b", seamIds: [] },
  { id: "stage-right", name: "右端异构端", color: "#a855f7", seamIds: [] }
];

const initialPose: LaserPoseDefinition = {
  referenceNormal: [0, 0, 1],
  normalFlipped: false,
  travelDirection: "forward",
  workAngleDeg: 35,
  travelAngleDeg: 10,
  lateralOffsetMm: 0,
  focusOffsetMm: 2,
  sampleCount: 16
};

export function createWorkbenchStore() {
  return createStore<WorkbenchState>()(createWorkbenchSlice);
}

const createWorkbenchSlice: StateCreator<WorkbenchState> = (set, get) => ({
    targetShape: "circle",
    workpiece: null,
    workpieceBaseUrl: null,
    candidates: [],
    selectedCandidateIds: [],
    hoverCandidateId: null,
    stages: initialStages,
    activeStageId: "stage-middle",
    seams: [],
    activeSeamId: null,
    poseDefinition: initialPose,
    sameDiameterSourceId: null,
    loadWorkpieceManifest: (manifest, manifestUrl) => {
      const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/"));
      set({
        workpiece: manifest,
        workpieceBaseUrl: baseUrl,
        candidates: manifestEdgesToCandidates(manifest.edges),
        selectedCandidateIds: [],
        hoverCandidateId: null,
        seams: [],
        activeSeamId: null,
        sameDiameterSourceId: null
      });
    },
    setTargetShape: (targetShape) =>
      set({
        targetShape,
        selectedCandidateIds: [],
        sameDiameterSourceId: null
      }),
    setActiveStage: (stageId) =>
      set({
        activeStageId: stageId,
        selectedCandidateIds: [],
        activeSeamId: null,
        sameDiameterSourceId: null
      }),
    setHoverCandidate: (candidateId) => set({ hoverCandidateId: candidateId }),
    toggleCandidate: (candidateId) =>
      set((state) => ({
        selectedCandidateIds: state.selectedCandidateIds.includes(candidateId)
          ? state.selectedCandidateIds.filter((id) => id !== candidateId)
          : [...state.selectedCandidateIds, candidateId]
      })),
    clearSelection: () => set({ selectedCandidateIds: [], sameDiameterSourceId: null }),
    confirmSelectionAsSeam: () => {
      const state = get();
      const selectedCandidates = state.selectedCandidateIds
        .map((id) => state.candidates.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is GeometryCandidate => Boolean(candidate));

      if (selectedCandidates.length === 0) {
        return;
      }

      const seamId = `seam-${String(state.seams.length + 1).padStart(2, "0")}`;
      const seam = {
        ...buildSeamFromCandidates(seamId, selectedCandidates),
        label: `S${state.seams.length + 1}`
      };

      set({
        seams: [...state.seams, seam],
        stages: state.stages.map((stage) =>
          stage.id === state.activeStageId ? { ...stage, seamIds: [...stage.seamIds, seam.id] } : stage
        ),
        activeSeamId: seam.id,
        selectedCandidateIds: [],
        sameDiameterSourceId: null
      });
    },
    setActiveSeam: (seamId) => set({ activeSeamId: seamId }),
    updatePoseDefinition: (patch) =>
      set((state) => ({
        poseDefinition: { ...state.poseDefinition, ...patch }
      })),
    setSameDiameterSource: (candidateId) => set({ sameDiameterSourceId: candidateId })
  });

export const useWorkbenchStore = create<WorkbenchState>()(createWorkbenchSlice);
