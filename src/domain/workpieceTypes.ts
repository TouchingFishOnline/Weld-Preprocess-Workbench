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
}

export interface WorkpieceFace {
  id: string;
  type: string;
  areaMm2: number;
  center: Vec3;
  bbox: WorkpieceBbox;
  surfaceType: number;
}

export interface WorkpieceManifest {
  id: string;
  sourceFile: string;
  sourceHash: string;
  units: "mm";
  modelUrl: string;
  stepUrl: string;
  bbox: WorkpieceBbox;
  displayTransform: DisplayTransform;
  edges: WorkpieceEdge[];
  faces: WorkpieceFace[];
}
