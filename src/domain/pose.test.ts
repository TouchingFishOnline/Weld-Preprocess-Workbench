import { describe, expect, it } from "vitest";
import { sampleTorchPoses } from "./pose";
import type { WeldSeam } from "./types";

const circularSeam: WeldSeam = {
  id: "seam-circle",
  label: "S1-01",
  segments: [
    {
      candidateId: "circle-1",
      shape: "circle",
      radiusMm: 10,
      center: [0, 0, 0],
      normal: [0, 0, 1],
      startAngleRad: 0,
      endAngleRad: Math.PI * 2,
      closed: true
    }
  ],
  fallbackPath: []
};

describe("sampleTorchPoses", () => {
  it("rotates torch poses around a circular seam", () => {
    const poses = sampleTorchPoses(circularSeam, {
      referenceNormal: [0, 0, 1],
      normalFlipped: false,
      travelDirection: "forward",
      workAngleDeg: 35,
      travelAngleDeg: 10,
      lateralOffsetMm: 0,
      focusOffsetMm: 2,
      sampleCount: 8
    });

    expect(poses).toHaveLength(8);
    expect(poses[0].position[0]).toBeCloseTo(10);
    expect(poses[2].position[1]).toBeGreaterThan(9);
    expect(poses[0].beamDirection).not.toEqual(poses[2].beamDirection);
  });
});
