import type { LaserPoseDefinition, TargetShape, WeldSeam, WeldStage } from "./types";
import type { WorkpieceManifest } from "./workpieceTypes";

export const WORKBENCH_PROJECT_KIND = "weld-preprocess-workbench";
export const WORKBENCH_PROJECT_VERSION = 1;

export interface WorkbenchProjectFile {
  kind: typeof WORKBENCH_PROJECT_KIND;
  version: number;
  exportedAt: string;
  workpiece: {
    id: string;
    sourceFile: string;
    sourceHash: string;
    units: WorkpieceManifest["units"];
  };
  plan: {
    targetShape: TargetShape;
    stages: WeldStage[];
    activeStageId: string | null;
    seams: WeldSeam[];
    activeSeamId: string | null;
    poseDefinition: LaserPoseDefinition;
  };
}

export type WorkbenchProjectImportResult =
  | { ok: true }
  | {
      ok: false;
      reason: "no-workpiece" | "invalid-project" | "unsupported-version" | "hash-mismatch";
      message: string;
    };

interface WorkbenchProjectSource {
  manifest: WorkpieceManifest;
  targetShape: TargetShape;
  stages: WeldStage[];
  activeStageId: string | null;
  seams: WeldSeam[];
  activeSeamId: string | null;
  poseDefinition: LaserPoseDefinition;
}

export function createWorkbenchProject(source: WorkbenchProjectSource): WorkbenchProjectFile {
  return {
    kind: WORKBENCH_PROJECT_KIND,
    version: WORKBENCH_PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    workpiece: {
      id: source.manifest.id,
      sourceFile: source.manifest.sourceFile,
      sourceHash: source.manifest.sourceHash,
      units: source.manifest.units
    },
    plan: {
      targetShape: source.targetShape,
      stages: cloneJson(source.stages),
      activeStageId: source.activeStageId,
      seams: cloneJson(source.seams),
      activeSeamId: source.activeSeamId,
      poseDefinition: cloneJson(source.poseDefinition)
    }
  };
}

export function validateWorkbenchProject(
  project: unknown,
  manifest: WorkpieceManifest | null
): WorkbenchProjectImportResult {
  if (!manifest) {
    return {
      ok: false,
      reason: "no-workpiece",
      message: "请先加载对应 STEP，再导入标注文件。"
    };
  }

  if (!isWorkbenchProjectFile(project)) {
    return {
      ok: false,
      reason: "invalid-project",
      message: "标注文件格式不正确。"
    };
  }

  if (project.version !== WORKBENCH_PROJECT_VERSION) {
    return {
      ok: false,
      reason: "unsupported-version",
      message: "标注文件版本不受支持。"
    };
  }

  if (project.workpiece.sourceHash !== manifest.sourceHash) {
    return {
      ok: false,
      reason: "hash-mismatch",
      message: "标注文件不属于当前 STEP，请先加载对应 STEP。"
    };
  }

  return { ok: true };
}

export function normalizeWorkbenchProject(project: WorkbenchProjectFile) {
  const stages = cloneJson(project.plan.stages);
  const seams = cloneJson(project.plan.seams);
  const stageIds = new Set(stages.map((stage) => stage.id));
  const seamIds = new Set(seams.map((seam) => seam.id));

  return {
    targetShape: project.plan.targetShape,
    stages,
    activeStageId:
      project.plan.activeStageId && stageIds.has(project.plan.activeStageId)
        ? project.plan.activeStageId
        : (stages[0]?.id ?? null),
    seams,
    activeSeamId:
      project.plan.activeSeamId && seamIds.has(project.plan.activeSeamId)
        ? project.plan.activeSeamId
        : (seams[0]?.id ?? null),
    poseDefinition: cloneJson(project.plan.poseDefinition)
  };
}

export function isWorkbenchProjectFile(project: unknown): project is WorkbenchProjectFile {
  if (!project || typeof project !== "object") {
    return false;
  }

  const value = project as Partial<WorkbenchProjectFile>;
  return (
    value.kind === WORKBENCH_PROJECT_KIND &&
    typeof value.version === "number" &&
    typeof value.exportedAt === "string" &&
    Boolean(value.workpiece) &&
    typeof value.workpiece?.sourceHash === "string" &&
    Boolean(value.plan) &&
    Array.isArray(value.plan?.stages) &&
    Array.isArray(value.plan?.seams) &&
    Boolean(value.plan?.poseDefinition)
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
