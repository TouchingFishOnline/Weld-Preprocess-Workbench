import { create } from "zustand";
import { createStore } from "zustand/vanilla";
import { buildSeamFromCandidates } from "../domain/geometry";
import {
  createWorkbenchProject,
  isWorkbenchProjectFile,
  normalizeWorkbenchProject,
  validateWorkbenchProject
} from "../domain/workbenchProject";
import { manifestToCandidates } from "../domain/workpiece";
import type {
  GeometryCandidate,
  LaserPoseDefinition,
  TargetShape,
  WeldSeam,
  WeldStage
} from "../domain/types";
import type { StateCreator } from "zustand";
import type {
  WorkbenchImportWarning,
  WorkbenchProjectFile,
  WorkbenchProjectImportOptions,
  WorkbenchProjectImportResult
} from "../domain/workbenchProject";
import type { WorkpieceManifest } from "../domain/workpieceTypes";

export interface WorkbenchState {
  targetShape: TargetShape;
  workpiece: WorkpieceManifest | null;
  workpieceBaseUrl: string | null;
  viewLocked: boolean;
  candidates: GeometryCandidate[];
  candidateKindFilter: string | null;
  candidateGroupHighlighted: boolean;
  selectedCandidateIds: string[];
  hoverCandidateId: string | null;
  stages: WeldStage[];
  activeStageId: string | null;
  seams: WeldSeam[];
  activeSeamId: string | null;
  poseDefinition: LaserPoseDefinition;
  defaultPoseDefinition: LaserPoseDefinition;
  importWarning: WorkbenchImportWarning | null;
  sameDiameterSourceId: string | null;
  loadWorkpieceManifest: (manifest: WorkpieceManifest, manifestUrl: string) => void;
  addStage: () => void;
  deleteStage: (stageId: string) => void;
  deleteSeam: (seamId: string) => void;
  moveSeamInStage: (stageId: string, seamId: string, direction: -1 | 1) => void;
  reorderSeamInStage: (stageId: string, seamId: string, targetIndex: number) => void;
  toggleViewLocked: () => void;
  setTargetShape: (targetShape: TargetShape) => void;
  setCandidateKindFilter: (candidateKind: string | null) => void;
  toggleCandidateGroupHighlight: () => void;
  setActiveStage: (stageId: string) => void;
  setHoverCandidate: (candidateId: string | null) => void;
  toggleCandidate: (candidateId: string) => void;
  clearSelection: () => void;
  confirmSelectionAsSeam: () => void;
  setActiveSeam: (seamId: string | null) => void;
  updatePoseDefinition: (patch: Partial<LaserPoseDefinition>) => void;
  saveCurrentPoseAsDefault: () => void;
  applyDefaultPoseToActiveSeam: () => void;
  setSameDiameterSource: (candidateId: string | null) => void;
  exportProject: () => WorkbenchProjectFile | null;
  importProject: (project: unknown, options?: WorkbenchProjectImportOptions) => WorkbenchProjectImportResult;
}

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

const stageColors = ["#2563eb", "#16a34a", "#f59e0b", "#a855f7", "#0f766e", "#dc2626"];

export function createWorkbenchStore() {
  return createStore<WorkbenchState>()(createWorkbenchSlice);
}

const createWorkbenchSlice: StateCreator<WorkbenchState> = (set, get) => ({
  targetShape: "circle",
  workpiece: null,
  workpieceBaseUrl: null,
  viewLocked: false,
  candidates: [],
  candidateKindFilter: null,
  candidateGroupHighlighted: false,
  selectedCandidateIds: [],
  hoverCandidateId: null,
  stages: [],
  activeStageId: null,
  seams: [],
  activeSeamId: null,
  poseDefinition: initialPose,
  defaultPoseDefinition: initialPose,
  importWarning: null,
  sameDiameterSourceId: null,
  loadWorkpieceManifest: (manifest, manifestUrl) => {
    const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/"));
    set({
      workpiece: manifest,
      workpieceBaseUrl: baseUrl,
      candidates: manifestToCandidates(manifest),
      candidateKindFilter: null,
      candidateGroupHighlighted: false,
      selectedCandidateIds: [],
      hoverCandidateId: null,
      stages: [],
      activeStageId: null,
      seams: [],
      activeSeamId: null,
      poseDefinition: clonePose(initialPose),
      defaultPoseDefinition: clonePose(initialPose),
      importWarning: null,
      sameDiameterSourceId: null
    });
  },
  addStage: () =>
    set((state) => {
      const stageIndex =
        Math.max(0, ...state.stages.map((stage) => Number(stage.id.replace("stage-", ""))).filter(Number.isFinite)) + 1;
      const stage: WeldStage = {
        id: `stage-${String(stageIndex).padStart(2, "0")}`,
        name: `阶段 ${stageIndex}`,
        color: stageColors[(stageIndex - 1) % stageColors.length],
        seamIds: []
      };
      return {
        stages: [...state.stages, stage],
        activeStageId: stage.id,
        selectedCandidateIds: [],
        activeSeamId: null,
        sameDiameterSourceId: null
      };
    }),
  deleteStage: (stageId) =>
    set((state) => {
      const stage = state.stages.find((item) => item.id === stageId);
      if (!stage) {
        return {};
      }
      const removedSeamIds = new Set(stage.seamIds);
      const stages = state.stages.filter((item) => item.id !== stageId);
      const seams = state.seams.filter((seam) => !removedSeamIds.has(seam.id));
      const activeStageId = state.activeStageId === stageId ? (stages[0]?.id ?? null) : state.activeStageId;
      const activeSeamId =
        state.activeSeamId && removedSeamIds.has(state.activeSeamId) ? null : state.activeSeamId;
      return { stages, seams, activeStageId, activeSeamId, selectedCandidateIds: [], sameDiameterSourceId: null };
    }),
  deleteSeam: (seamId) =>
    set((state) => ({
      seams: state.seams.filter((seam) => seam.id !== seamId),
      stages: state.stages.map((stage) => ({ ...stage, seamIds: stage.seamIds.filter((id) => id !== seamId) })),
      activeSeamId: state.activeSeamId === seamId ? null : state.activeSeamId,
      selectedCandidateIds: [],
      sameDiameterSourceId: null
    })),
  moveSeamInStage: (stageId, seamId, direction) =>
    set((state) => ({
      stages: state.stages.map((stage) => {
        if (stage.id !== stageId) {
          return stage;
        }
        const seamIds = [...stage.seamIds];
        const index = seamIds.indexOf(seamId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= seamIds.length) {
          return stage;
        }
        [seamIds[index], seamIds[nextIndex]] = [seamIds[nextIndex], seamIds[index]];
        return { ...stage, seamIds };
      })
    })),
  reorderSeamInStage: (stageId, seamId, targetIndex) =>
    set((state) => ({
      stages: state.stages.map((stage) => {
        if (stage.id !== stageId) {
          return stage;
        }
        const currentIndex = stage.seamIds.indexOf(seamId);
        if (currentIndex < 0) {
          return stage;
        }
        const seamIds = [...stage.seamIds];
        const [movedSeamId] = seamIds.splice(currentIndex, 1);
        const boundedIndex = Math.max(0, Math.min(targetIndex, seamIds.length));
        seamIds.splice(boundedIndex, 0, movedSeamId);
        return { ...stage, seamIds };
      })
    })),
  toggleViewLocked: () => set((state) => ({ viewLocked: !state.viewLocked })),
  setTargetShape: (targetShape) =>
    set({
      targetShape,
      candidateKindFilter: null,
      candidateGroupHighlighted: false,
      selectedCandidateIds: [],
      sameDiameterSourceId: null
    }),
  setCandidateKindFilter: (candidateKindFilter) =>
    set({
      candidateKindFilter,
      candidateGroupHighlighted: false,
      selectedCandidateIds: [],
      sameDiameterSourceId: null
    }),
  toggleCandidateGroupHighlight: () =>
    set((state) => ({
      candidateGroupHighlighted: !state.candidateGroupHighlighted
    })),
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

    if (selectedCandidates.length === 0 || !state.activeStageId) {
      return;
    }

    const seamIndex =
      Math.max(0, ...state.seams.map((seam) => Number(seam.id.replace("seam-", ""))).filter(Number.isFinite)) + 1;
    const seamId = `seam-${String(seamIndex).padStart(2, "0")}`;
    const seam = {
      ...buildSeamFromCandidates(seamId, selectedCandidates),
      label: `S${seamIndex}`,
      poseDefinition: clonePose(state.defaultPoseDefinition)
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
  setActiveSeam: (seamId) =>
    set((state) => {
      const seam = seamId ? state.seams.find((item) => item.id === seamId) : null;
      return {
        activeSeamId: seamId,
        poseDefinition: clonePose(seam?.poseDefinition ?? state.defaultPoseDefinition)
      };
    }),
  updatePoseDefinition: (patch) =>
    set((state) => ({
      poseDefinition: { ...state.poseDefinition, ...patch },
      seams: state.activeSeamId
        ? state.seams.map((seam) =>
            seam.id === state.activeSeamId
              ? { ...seam, poseDefinition: { ...(seam.poseDefinition ?? state.defaultPoseDefinition), ...patch } }
              : seam
          )
        : state.seams
    })),
  saveCurrentPoseAsDefault: () =>
    set((state) => ({
      defaultPoseDefinition: clonePose(state.poseDefinition)
    })),
  applyDefaultPoseToActiveSeam: () =>
    set((state) => {
      if (!state.activeSeamId) {
        return { poseDefinition: clonePose(state.defaultPoseDefinition) };
      }
      return {
        poseDefinition: clonePose(state.defaultPoseDefinition),
        seams: state.seams.map((seam) =>
          seam.id === state.activeSeamId ? { ...seam, poseDefinition: clonePose(state.defaultPoseDefinition) } : seam
        )
      };
    }),
  setSameDiameterSource: (candidateId) => set({ sameDiameterSourceId: candidateId }),
  exportProject: () => {
    const state = get();
    if (!state.workpiece) {
      return null;
    }

    return createWorkbenchProject({
      manifest: state.workpiece,
      targetShape: state.targetShape,
      stages: state.stages,
      activeStageId: state.activeStageId,
      seams: state.seams,
      activeSeamId: state.activeSeamId,
      poseDefinition: state.poseDefinition,
      defaultPoseDefinition: state.defaultPoseDefinition,
      importWarning: state.importWarning
    });
  },
  importProject: (project, options) => {
    const validation = validateWorkbenchProject(project, get().workpiece, options);
    if (!validation.ok) {
      return validation;
    }

    if (!isWorkbenchProjectFile(project)) {
      return {
        ok: false,
        reason: "invalid-project",
        message: "标注文件格式不正确。"
      };
    }

    const normalizedProject = normalizeWorkbenchProject(project);
    set({
      ...normalizedProject,
      selectedCandidateIds: [],
      hoverCandidateId: null,
      candidateKindFilter: null,
      candidateGroupHighlighted: false,
      importWarning: validation.warning ?? project.importWarning ?? null,
      sameDiameterSourceId: null
    });

    return validation;
  }
});

export const useWorkbenchStore = create<WorkbenchState>()(createWorkbenchSlice);

function clonePose(pose: LaserPoseDefinition): LaserPoseDefinition {
  return JSON.parse(JSON.stringify(pose)) as LaserPoseDefinition;
}
