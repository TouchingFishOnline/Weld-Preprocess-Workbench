import type { WorkpieceManifest } from "./workpieceTypes";

export const DEMO_MANIFEST_URL = "/workpieces/manifold-combined/manifest.json";

export async function fetchWorkpieceManifest(manifestUrl: string): Promise<WorkpieceManifest> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to load workpiece manifest: ${response.status}`);
  }
  return response.json() as Promise<WorkpieceManifest>;
}

export interface UploadStepOptions {
  preprocess: boolean;
}

export async function uploadStepFile(
  file: File,
  options: UploadStepOptions = { preprocess: false }
): Promise<{ manifest: WorkpieceManifest; manifestUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("preprocess", String(options.preprocess));
  const response = await fetch("/api/workpieces", {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    throw new Error(`STEP preprocessing failed: ${response.status}`);
  }
  return response.json() as Promise<{ manifest: WorkpieceManifest; manifestUrl: string }>;
}
