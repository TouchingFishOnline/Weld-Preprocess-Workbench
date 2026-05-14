import type { GeometryCandidate } from "./types";

const nozzleCenters = Array.from({ length: 27 }, (_, index) => 76.15 + index * 44.45);
const smallNozzleCenters = [90.985, 173.185, 383.485, 465.685, 822.235, 904.435, 1114.735, 1196.935];

export const manifoldDimensions = {
  lengthMm: 1510.86,
  bodyLengthMm: 1308,
  widthMm: 90.32,
  heightMm: 109.55
};

export const sampleManifoldCandidates: GeometryCandidate[] = [
  ...nozzleCenters.map<GeometryCandidate>((y, index) => ({
    id: `top-nozzle-${String(index + 1).padStart(2, "0")}`,
    shape: "circle",
    kind: "circle",
    label: `N${index + 1}`,
    radiusMm: 12.5,
    center: [y, 0, 54],
    normal: [0, 0, 1],
    startAngleRad: 0,
    endAngleRad: Math.PI * 2,
    closed: true
  })),
  ...smallNozzleCenters.map<GeometryCandidate>((y, index) => ({
    id: `small-port-${String(index + 1).padStart(2, "0")}`,
    shape: "circle",
    kind: "circle",
    label: `P${index + 1}`,
    radiusMm: 6.5,
    center: [y, -36, -24],
    normal: [0, 0, 1],
    startAngleRad: 0,
    endAngleRad: Math.PI * 2,
    closed: true
  })),
  {
    id: "left-end-rectangle",
    shape: "rectangle",
    kind: "polyline",
    label: "L-END",
    points: [
      [-30, -32, -30],
      [10, -32, -30],
      [10, 32, -30],
      [-30, 32, -30]
    ],
    closed: true
  },
  {
    id: "right-oblique-arc",
    shape: "circle",
    kind: "arc",
    label: "R-ARC",
    radiusMm: 28.15,
    center: [1390, 24, -26],
    normal: [0.183, 0.707, -0.683],
    startAngleRad: -0.15 * Math.PI,
    endAngleRad: 1.2 * Math.PI,
    closed: false
  },
  {
    id: "long-edge-top-left",
    shape: "edge",
    kind: "line",
    label: "E-TL",
    points: [
      [0, -22, 28],
      [1308, -22, 28]
    ],
    closed: false
  },
  {
    id: "long-edge-top-right",
    shape: "edge",
    kind: "line",
    label: "E-TR",
    points: [
      [0, 22, 28],
      [1308, 22, 28]
    ],
    closed: false
  }
];
