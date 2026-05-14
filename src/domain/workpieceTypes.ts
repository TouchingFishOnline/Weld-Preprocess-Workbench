import type { Vec3 } from "./types";

export interface DisplayTransform {
  center: Vec3;
  scale: number;
  cadToScene?: "x,z,-y";
}

export interface WorkpieceBbox {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  size: Vec3;
}

export interface WorkpieceEdge {
  id: string;
  type: "circle" | "line";
  closed: boolean;
  lengthMm: number;
  polyline: Vec3[];
  radiusMm?: number;
  diameterMm?: number;
  center?: Vec3;
  normal?: Vec3;
  adjacentFaceIds?: string[];
}

export interface WorkpieceFace {
  id: string;
  type: string;
  areaMm2: number;
  center: Vec3;
  bbox: WorkpieceBbox;
  surfaceType: number;
  normal?: Vec3;
  axis?: Vec3;
  radiusMm?: number;
  referenceRadiusMm?: number;
  semiAngleRad?: number;
  majorRadiusMm?: number;
  minorRadiusMm?: number;
}

export interface WorkpieceCandidateFrame {
  tangent: Vec3;
  referenceNormal: Vec3;
  adjacentNormals: Vec3[];
}

export type WorkpieceSeamCandidate =
  | {
  id: string;
      kind:
        | "nozzle-root-circular"
        | "end-cap-circular"
        | "side-fitting-circular"
        | "backside-nozzle-circular"
        | "unknown-round-edge-group"
        | string;
  shape: "circle";
  label: string;
  sourceEdgeIds: string[];
      adjacentFaceIds?: string[];
      adjacentFaceTypes?: string[];
  radiusMm: number;
  diameterMm: number;
  center: Vec3;
  normal: Vec3;
  closed: boolean;
  confidence: number;
  polyline: Vec3[];
      frame?: WorkpieceCandidateFrame;
    }
  | {
      id: string;
      kind: "linear-body-seam" | string;
      shape: "edge";
      label: string;
      sourceEdgeIds: string[];
      adjacentFaceIds?: string[];
      adjacentFaceTypes?: string[];
      closed: boolean;
      confidence: number;
      points: Vec3[];
      frame?: WorkpieceCandidateFrame;
    }
  | {
      id: string;
      kind: "rectangular-sleeve-root-seam" | string;
      shape: "rectangle";
      label: string;
      sourceEdgeIds: string[];
      adjacentFaceIds?: string[];
      adjacentFaceTypes?: string[];
      closed: boolean;
      confidence: number;
      points: Vec3[];
      frame?: WorkpieceCandidateFrame;
    };

export interface WorkpieceManifest {
  id: string;
  sourceFile: string;
  sourceHash: string;
  units: "mm";
  modelUrl: string;
  stepUrl: string;
  seamCandidateUrl?: string;
  bbox: WorkpieceBbox;
  displayTransform: DisplayTransform;
  edges: WorkpieceEdge[];
  faces: WorkpieceFace[];
  seamCandidates?: WorkpieceSeamCandidate[];
}
