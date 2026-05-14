import type { GeometryCandidate, Vec3 } from "./types";
import type { DisplayTransform, WorkpieceEdge } from "./workpieceTypes";

export function transformPoint(point: Vec3, transform: DisplayTransform): Vec3 {
  const scenePoint: Vec3 = transform.cadToScene === "x,z,-y" ? [point[0], point[2], -point[1]] : point;
  return [
    (scenePoint[0] - transform.center[0]) * transform.scale,
    (scenePoint[1] - transform.center[1]) * transform.scale,
    (scenePoint[2] - transform.center[2]) * transform.scale
  ];
}

export function edgeToCandidate(edge: WorkpieceEdge): GeometryCandidate | null {
  if (edge.type === "circle" && edge.radiusMm !== undefined && edge.center && edge.normal) {
    return {
      id: edge.id,
      shape: "circle",
      kind: edge.closed ? "circle" : "arc",
      label: edge.id,
      radiusMm: edge.radiusMm,
      center: edge.center,
      normal: edge.normal,
      startAngleRad: 0,
      endAngleRad: Math.PI * 2,
      closed: edge.closed,
      polyline: edge.polyline
    };
  }

  if (edge.type === "line") {
    return {
      id: edge.id,
      shape: "edge",
      kind: "line",
      label: edge.id,
      points: edge.polyline,
      closed: edge.closed
    };
  }

  return null;
}

export function manifestEdgesToCandidates(edges: WorkpieceEdge[]): GeometryCandidate[] {
  return edges.map(edgeToCandidate).filter((candidate): candidate is GeometryCandidate => Boolean(candidate));
}
