import { describe, expect, it } from "vitest";
import {
  buildSeamFromCandidates,
  filterCandidatesForWorkbench,
  findSameDiameterCandidates,
  filterCandidatesByTargetShape
} from "./geometry";
import type { GeometryCandidate } from "./types";

const candidates: GeometryCandidate[] = [
  {
    id: "arc-a",
    shape: "circle",
    kind: "arc",
    label: "A",
    radiusMm: 12.5,
    center: [0, 0, 0],
    normal: [0, 0, 1],
    startAngleRad: 0,
    endAngleRad: Math.PI,
    closed: false
  },
  {
    id: "circle-b",
    shape: "circle",
    kind: "circle",
    label: "B",
    radiusMm: 12.5,
    center: [44.45, 0, 0],
    normal: [0, 0, 1],
    startAngleRad: 0,
    endAngleRad: Math.PI * 2,
    closed: true
  },
  {
    id: "rect-a",
    shape: "rectangle",
    kind: "polyline",
    label: "C",
    points: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 5, 0],
      [0, 5, 0]
    ],
    closed: true
  }
];

describe("filterCandidatesByTargetShape", () => {
  it("includes circular arcs when target shape is circle", () => {
    const result = filterCandidatesByTargetShape(candidates, "circle");

    expect(result.map((candidate) => candidate.id)).toEqual(["arc-a", "circle-b"]);
  });

  it("returns all candidates when target shape is edge", () => {
    const result = filterCandidatesByTargetShape(candidates, "edge");

    expect(result).toHaveLength(3);
  });

  it("filters visible candidates by semantic recommendation kind after target shape", () => {
    const semanticCandidates: GeometryCandidate[] = [
      { ...candidates[0], semanticKind: "nozzle-root-circular" },
      { ...candidates[1], semanticKind: "end-cap-circular" },
      { ...candidates[2], semanticKind: "linear-body-seam" }
    ];

    expect(filterCandidatesForWorkbench(semanticCandidates, "circle", "end-cap-circular").map((candidate) => candidate.id)).toEqual([
      "circle-b"
    ]);
    expect(filterCandidatesForWorkbench(semanticCandidates, "edge", "linear-body-seam").map((candidate) => candidate.id)).toEqual([
      "rect-a"
    ]);
  });
});

describe("findSameDiameterCandidates", () => {
  it("selects only circular candidates with matching diameter", () => {
    const result = findSameDiameterCandidates(candidates, "arc-a", 0.01);

    expect(result.map((candidate) => candidate.id)).toEqual(["arc-a", "circle-b"]);
  });
});

describe("buildSeamFromCandidates", () => {
  it("creates an ordered seam with fallback path samples", () => {
    const seam = buildSeamFromCandidates("seam-1", [candidates[0], candidates[1]]);

    expect(seam.id).toBe("seam-1");
    expect(seam.segments.map((segment) => segment.candidateId)).toEqual(["arc-a", "circle-b"]);
    expect(seam.fallbackPath.length).toBeGreaterThan(8);
  });

  it("uses source polyline samples when a circular candidate provides them", () => {
    const seam = buildSeamFromCandidates("seam-2", [
      {
        id: "arc-polyline",
        shape: "circle",
        kind: "arc",
        label: "polyline",
        radiusMm: 12.5,
        center: [0, 0, 0],
        normal: [0, 0, 1],
        startAngleRad: 0,
        endAngleRad: Math.PI,
        closed: false,
        polyline: [
          [1, 2, 3],
          [4, 5, 6]
        ]
      }
    ]);

    expect(seam.fallbackPath).toEqual([
      [1, 2, 3],
      [4, 5, 6]
    ]);
  });
});
