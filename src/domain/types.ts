export type Vec3 = [number, number, number];

export type TargetShape = "circle" | "rectangle" | "edge";

export type TravelDirection = "forward" | "reverse";

export type GeometryCandidate =
  | {
      id: string;
      shape: "circle";
      kind: "circle" | "arc";
      label: string;
      radiusMm: number;
      center: Vec3;
      normal: Vec3;
      startAngleRad: number;
      endAngleRad: number;
      closed: boolean;
      polyline?: Vec3[];
    }
  | {
      id: string;
      shape: "rectangle";
      kind: "polyline";
      label: string;
      points: Vec3[];
      closed: boolean;
    }
  | {
      id: string;
      shape: "edge";
      kind: "line";
      label: string;
      points: Vec3[];
      closed: boolean;
    };

export type WeldSeamSegment =
  | {
      candidateId: string;
      shape: "circle";
      radiusMm: number;
      center: Vec3;
      normal: Vec3;
      startAngleRad: number;
      endAngleRad: number;
      closed: boolean;
      polyline?: Vec3[];
    }
  | {
      candidateId: string;
      shape: "rectangle" | "edge";
      points: Vec3[];
      closed: boolean;
    };

export interface WeldSeam {
  id: string;
  label: string;
  segments: WeldSeamSegment[];
  fallbackPath: Vec3[];
}

export interface WeldStage {
  id: string;
  name: string;
  color: string;
  seamIds: string[];
}

export interface LaserPoseDefinition {
  referenceNormal: Vec3;
  normalFlipped: boolean;
  travelDirection: TravelDirection;
  workAngleDeg: number;
  travelAngleDeg: number;
  lateralOffsetMm: number;
  focusOffsetMm: number;
  sampleCount: number;
}

export interface TorchPoseSample {
  position: Vec3;
  tangent: Vec3;
  referenceNormal: Vec3;
  side: Vec3;
  beamDirection: Vec3;
}
