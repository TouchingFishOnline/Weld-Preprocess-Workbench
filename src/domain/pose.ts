import type { LaserPoseDefinition, TorchPoseSample, Vec3, WeldSeam, WeldSeamSegment } from "./types";
import { add, cross, degToRad, normalize, rotateAroundAxis, scale, subtract } from "./vector";

export function sampleTorchPoses(seam: WeldSeam, definition: LaserPoseDefinition): TorchPoseSample[] {
  const primaryCircle = seam.segments.find((segment) => segment.shape === "circle");
  if (primaryCircle) {
    return sampleCircularPoses(primaryCircle, definition);
  }

  return samplePolylinePoses(seam.fallbackPath, definition);
}

function sampleCircularPoses(
  segment: Extract<WeldSeamSegment, { shape: "circle" }>,
  definition: LaserPoseDefinition
): TorchPoseSample[] {
  const count = Math.max(2, definition.sampleCount);
  const directionMultiplier = definition.travelDirection === "forward" ? 1 : -1;
  const referenceNormal = normalize(
    definition.normalFlipped ? scale(definition.referenceNormal, -1) : definition.referenceNormal,
    segment.normal
  );
  const angleSpan = segment.endAngleRad - segment.startAngleRad;

  return Array.from({ length: count }, (_, index) => {
    const t = segment.closed ? index / count : index / (count - 1);
    const angle = segment.startAngleRad + angleSpan * t;
    const radial: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
    const position: Vec3 = [
      segment.center[0] + radial[0] * segment.radiusMm,
      segment.center[1] + radial[1] * segment.radiusMm,
      segment.center[2]
    ];
    const tangent = normalize(
      [-Math.sin(angle) * directionMultiplier, Math.cos(angle) * directionMultiplier, 0],
      [0, 1, 0]
    );
    return buildPose(position, tangent, referenceNormal, definition);
  });
}

function samplePolylinePoses(path: Vec3[], definition: LaserPoseDefinition): TorchPoseSample[] {
  if (path.length === 0) {
    return [];
  }

  const count = Math.max(2, Math.min(definition.sampleCount, path.length));
  const normal = normalize(
    definition.normalFlipped ? scale(definition.referenceNormal, -1) : definition.referenceNormal,
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
    return buildPose(path[sourceIndex], tangent, normal, definition);
  });
}

function buildPose(
  seamPosition: Vec3,
  tangent: Vec3,
  referenceNormal: Vec3,
  definition: LaserPoseDefinition
): TorchPoseSample {
  const normal = normalize(referenceNormal, [0, 0, 1]);
  const side = normalize(cross(tangent, normal), [1, 0, 0]);
  const workRotated = rotateAroundAxis(scale(normal, -1), tangent, degToRad(definition.workAngleDeg));
  const beamDirection = normalize(rotateAroundAxis(workRotated, side, degToRad(definition.travelAngleDeg)));
  const position = add(
    add(seamPosition, scale(side, definition.lateralOffsetMm)),
    scale(normal, definition.focusOffsetMm)
  );

  return {
    position,
    tangent,
    referenceNormal: normal,
    side,
    beamDirection
  };
}
