import type { Vec3 } from "./types";

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v: Vec3, amount: number): Vec3 {
  return [v[0] * amount, v[1] * amount, v[2] * amount];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize(v: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3 {
  const magnitude = length(v);
  if (magnitude < 1e-9) {
    return fallback;
  }
  return [v[0] / magnitude, v[1] / magnitude, v[2] / magnitude];
}

export function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const unitAxis = normalize(axis);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const term1 = scale(v, cos);
  const term2 = scale(cross(unitAxis, v), sin);
  const term3 = scale(unitAxis, dot(unitAxis, v) * (1 - cos));
  return add(add(term1, term2), term3);
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
