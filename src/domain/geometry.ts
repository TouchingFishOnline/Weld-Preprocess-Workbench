import type { GeometryCandidate, TargetShape, Vec3, WeldSeam, WeldSeamSegment } from "./types";

export function filterCandidatesByTargetShape(
  candidates: GeometryCandidate[],
  targetShape: TargetShape
): GeometryCandidate[] {
  if (targetShape === "edge") {
    return candidates;
  }
  return candidates.filter((candidate) => candidate.shape === targetShape);
}

export function findSameDiameterCandidates(
  candidates: GeometryCandidate[],
  sourceId: string,
  toleranceMm = 0.05
): GeometryCandidate[] {
  const source = candidates.find((candidate) => candidate.id === sourceId);
  if (!source || source.shape !== "circle") {
    return [];
  }

  const sourceDiameter = source.radiusMm * 2;
  return candidates.filter((candidate) => {
    if (candidate.shape !== "circle") {
      return false;
    }
    return Math.abs(candidate.radiusMm * 2 - sourceDiameter) <= toleranceMm;
  });
}

export function buildSeamFromCandidates(id: string, candidates: GeometryCandidate[]): WeldSeam {
  const segments = candidates.map(candidateToSegment);
  return {
    id,
    label: id.toUpperCase(),
    segments,
    fallbackPath: segments.flatMap((segment) => sampleSegmentPath(segment))
  };
}

export function sampleSegmentPath(segment: WeldSeamSegment, samples = 16): Vec3[] {
  if (segment.shape !== "circle") {
    return segment.points;
  }

  if (segment.polyline && segment.polyline.length > 0) {
    return segment.polyline;
  }

  const angleSpan = segment.endAngleRad - segment.startAngleRad;
  const count = segment.closed ? samples : Math.max(2, Math.ceil(samples * Math.abs(angleSpan) / (Math.PI * 2)));
  const denominator = segment.closed ? count : count - 1;

  return Array.from({ length: count }, (_, index) => {
    const t = denominator === 0 ? 0 : index / denominator;
    const angle = segment.startAngleRad + angleSpan * t;
    return [
      segment.center[0] + Math.cos(angle) * segment.radiusMm,
      segment.center[1] + Math.sin(angle) * segment.radiusMm,
      segment.center[2]
    ];
  });
}

function candidateToSegment(candidate: GeometryCandidate): WeldSeamSegment {
  if (candidate.shape === "circle") {
    return {
      candidateId: candidate.id,
      shape: "circle",
      radiusMm: candidate.radiusMm,
      center: candidate.center,
      normal: candidate.normal,
      startAngleRad: candidate.startAngleRad,
      endAngleRad: candidate.endAngleRad,
      closed: candidate.closed,
      polyline: candidate.polyline
    };
  }

  return {
    candidateId: candidate.id,
    shape: candidate.shape,
    points: candidate.points,
    closed: candidate.closed
  };
}
