import type { LaserPoseDefinition, TorchPoseSample, Vec3, WeldSeam, WeldSeamSegment } from "./types";
import { add, cross, degToRad, dot, normalize, rotateAroundAxis, scale, subtract } from "./vector";

export function sampleTorchPoses(seam: WeldSeam, definition: LaserPoseDefinition): TorchPoseSample[] {
  const primaryCircle = seam.segments.find((segment) => segment.shape === "circle");
  if (primaryCircle) {
    if (primaryCircle.polyline && primaryCircle.polyline.length > 1) {
      return samplePolylinePoses(primaryCircle.polyline, definition, primaryCircle.normal);
    }
    return sampleCircularPoses(primaryCircle, definition);
  }

  const primaryPolyline = seam.segments.find((segment) => segment.shape !== "circle");
  return samplePolylinePoses(seam.fallbackPath, definition, primaryPolyline?.frame?.referenceNormal ?? [0, 0, 1], primaryPolyline?.frame?.referenceNormal);
}

function sampleCircularPoses(
  segment: Extract<WeldSeamSegment, { shape: "circle" }>,
  definition: LaserPoseDefinition
): TorchPoseSample[] {
  const count = Math.max(2, definition.sampleCount);
  const directionMultiplier = definition.travelDirection === "forward" ? 1 : -1;
  const circleNormal = normalize(segment.normal, [0, 0, 1]);
  const basis = circleBasis(circleNormal);
  const referenceNormal = normalize(
    definition.normalFlipped ? scale(definition.referenceNormal, -1) : definition.referenceNormal,
    segment.normal
  );
  const angleSpan = segment.endAngleRad - segment.startAngleRad;

  return Array.from({ length: count }, (_, index) => {
    const t = segment.closed ? index / count : index / (count - 1);
    const angle = segment.startAngleRad + angleSpan * t;
    const radial = add(scale(basis.u, Math.cos(angle)), scale(basis.v, Math.sin(angle)));
    const position = add(segment.center, scale(radial, segment.radiusMm));
    const tangent = normalize(cross(circleNormal, radial), basis.v);
    return buildPose(cleanVec(position), scale(tangent, directionMultiplier), referenceNormal, definition, circleNormal);
  });
}

function samplePolylinePoses(
  path: Vec3[],
  definition: LaserPoseDefinition,
  fallbackNormal: Vec3,
  preferredNormal?: Vec3
): TorchPoseSample[] {
  if (path.length === 0) {
    return [];
  }

  const count = Math.max(2, Math.min(definition.sampleCount, path.length));
  const requestedNormal = preferredNormal ?? definition.referenceNormal;
  const normal = normalize(
    definition.normalFlipped ? scale(requestedNormal, -1) : requestedNormal,
    [0, 0, 1]
  );

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex =
      definition.travelDirection === "forward"
        ? Math.round((index / (count - 1)) * (path.length - 1))
        : Math.round(((count - 1 - index) / (count - 1)) * (path.length - 1));
    const nextIndex = Math.min(path.length - 1, sourceIndex + 1);
    const previousIndex = Math.max(0, sourceIndex - 1);
    const tangent = normalize(subtract(path[nextIndex], path[previousIndex]), [1, 0, 0]);
    return buildPose(path[sourceIndex], tangent, normal, definition, fallbackNormal);
  });
}

function buildPose(
  seamPosition: Vec3,
  tangent: Vec3,
  referenceNormal: Vec3,
  definition: LaserPoseDefinition,
  fallbackNormal: Vec3
): TorchPoseSample {
  const travel = normalize(tangent, [1, 0, 0]);
  const normal = frameNormal(travel, referenceNormal, fallbackNormal);
  const side = normalize(cross(travel, normal), [1, 0, 0]);
  const workRotated = rotateAroundAxis(scale(normal, -1), travel, degToRad(definition.workAngleDeg));
  const beamDirection = normalize(rotateAroundAxis(workRotated, side, degToRad(definition.travelAngleDeg)));
  const position = add(
    add(seamPosition, scale(side, definition.lateralOffsetMm)),
    scale(normal, definition.focusOffsetMm)
  );

  return {
    position: cleanVec(position),
    tangent: cleanVec(travel),
    referenceNormal: cleanVec(normal),
    side: cleanVec(side),
    beamDirection: cleanVec(beamDirection)
  };
}

function circleBasis(normal: Vec3): { u: Vec3; v: Vec3 } {
  const helper: Vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(helper, normal), [1, 0, 0]);
  const v = normalize(cross(normal, u), [0, 1, 0]);
  return { u, v };
}

function frameNormal(tangent: Vec3, requestedNormal: Vec3, fallbackNormal: Vec3): Vec3 {
  const projectedRequested = projectPerpendicular(requestedNormal, tangent);
  if (projectedRequested) {
    return projectedRequested;
  }

  const projectedFallback = projectPerpendicular(fallbackNormal, tangent);
  if (projectedFallback) {
    return projectedFallback;
  }

  return circleBasis(tangent).u;
}

function projectPerpendicular(vector: Vec3, axis: Vec3): Vec3 | null {
  const projected = subtract(vector, scale(axis, dot(vector, axis)));
  const normalized = normalize(projected, [0, 0, 0]);
  return normalized[0] === 0 && normalized[1] === 0 && normalized[2] === 0 ? null : normalized;
}

function cleanVec(vector: Vec3): Vec3 {
  return vector.map((component) => (Math.abs(component) < 1e-12 ? 0 : component)) as Vec3;
}
