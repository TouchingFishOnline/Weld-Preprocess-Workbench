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

  it("uses STEP polyline samples for circular seams that are not in the XY plane", () => {
    const seam: WeldSeam = {
      id: "tilted-circle",
      label: "S-tilted",
      segments: [
        {
          candidateId: "edge-polyline-circle",
          shape: "circle",
          radiusMm: 10,
          center: [100, 100, 100],
          normal: [1, 0, 0],
          startAngleRad: 0,
          endAngleRad: Math.PI * 2,
          closed: false,
          polyline: [
            [0, 0, 0],
            [0, 0, 10],
            [0, 0, 20]
          ]
        }
      ],
      fallbackPath: [
        [0, 0, 0],
        [0, 0, 10],
        [0, 0, 20]
      ]
    };

    const poses = sampleTorchPoses(seam, {
      referenceNormal: [0, 1, 0],
      normalFlipped: false,
      travelDirection: "forward",
      workAngleDeg: 0,
      travelAngleDeg: 0,
      lateralOffsetMm: 0,
      focusOffsetMm: 2,
      sampleCount: 3
    });

    expect(poses.map((pose) => pose.position)).toEqual([
      [0, 2, 0],
      [0, 2, 10],
      [0, 2, 20]
    ]);
    expect(poses[1].tangent).toEqual([0, 0, 1]);
    expect(poses[1].referenceNormal).toEqual([0, 1, 0]);
  });

  it("builds circular poses in the plane described by the segment normal", () => {
    const seam: WeldSeam = {
      id: "yz-circle",
      label: "S-yz",
      segments: [
        {
          candidateId: "edge-yz-circle",
          shape: "circle",
          radiusMm: 10,
          center: [0, 0, 0],
          normal: [1, 0, 0],
          startAngleRad: 0,
          endAngleRad: Math.PI * 2,
          closed: true
        }
      ],
      fallbackPath: []
    };

    const poses = sampleTorchPoses(seam, {
      referenceNormal: [1, 0, 0],
      normalFlipped: false,
      travelDirection: "forward",
      workAngleDeg: 0,
      travelAngleDeg: 0,
      lateralOffsetMm: 0,
      focusOffsetMm: 0,
      sampleCount: 4
    });

    expect(poses.map((pose) => pose.position[0])).toEqual([0, 0, 0, 0]);
    expect(poses[0].position).toEqual([0, 0, -10]);
    expect(poses[1].position).toEqual([0, 10, 0]);
  });

  it("uses signed work angles to choose the laser approach side on straight seams", () => {
    const straightSeam: WeldSeam = {
      id: "straight",
      label: "S-line",
      segments: [
        {
          candidateId: "edge-1",
          shape: "edge",
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ],
          closed: false
        }
      ],
      fallbackPath: [
        [0, 0, 0],
        [10, 0, 0]
      ]
    };

    const positive = sampleTorchPoses(straightSeam, {
      referenceNormal: [0, 0, 1],
      normalFlipped: false,
      travelDirection: "forward",
      workAngleDeg: 35,
      travelAngleDeg: 0,
      lateralOffsetMm: 0,
      focusOffsetMm: 0,
      sampleCount: 2
    })[0];
    const negative = sampleTorchPoses(straightSeam, {
      referenceNormal: [0, 0, 1],
      normalFlipped: false,
      travelDirection: "forward",
      workAngleDeg: -35,
      travelAngleDeg: 0,
      lateralOffsetMm: 0,
      focusOffsetMm: 0,
      sampleCount: 2
    })[0];

    expect(Math.sign(positive.beamDirection[1])).toBe(-Math.sign(negative.beamDirection[1]));
    expect(positive.beamDirection[2]).toBeCloseTo(negative.beamDirection[2]);
  });
});
