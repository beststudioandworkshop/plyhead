import type { Axis, Box, Vec3 } from "./types"

/**
 * Orientation helpers. Every part is axis-aligned, so its rotation is one of
 * 24 right-angle orientations. Local frame: X = length, Y = thickness,
 * Z = width. We build the matrix whose columns are the world axes the local
 * axes land on, then convert to Euler XYZ (Three.js convention).
 */

export const boxSize = (b: Box): Vec3 => [
  b.max[0] - b.min[0],
  b.max[1] - b.min[1],
  b.max[2] - b.min[2],
]

export const boxCenter = (b: Box): Vec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
]

type Mat3 = [Vec3, Vec3, Vec3] // rows

function permutationDeterminant(cols: [Axis, Axis, Axis]): number {
  const [a, b, c] = cols
  // parity of the permutation (a, b, c)
  const inversions = (a > b ? 1 : 0) + (a > c ? 1 : 0) + (b > c ? 1 : 0)
  return inversions % 2 === 0 ? 1 : -1
}

/**
 * Euler XYZ (radians) that maps local X → `lengthAxis`, local Y →
 * `thicknessAxis`, local Z → `widthAxis`. The three axes must be distinct.
 * If the permutation is a reflection, the width direction is negated; parts
 * are symmetric, so this changes nothing physical.
 */
export function eulerFromAxes(lengthAxis: Axis, thicknessAxis: Axis, widthAxis: Axis): Vec3 {
  const cols: [Axis, Axis, Axis] = [lengthAxis, thicknessAxis, widthAxis]
  const widthSign = permutationDeterminant(cols)
  const m: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  m[lengthAxis][0] = 1
  m[thicknessAxis][1] = 1
  m[widthAxis][2] = widthSign

  const clamp = (v: number) => Math.min(1, Math.max(-1, v))
  const y = Math.asin(clamp(m[0][2]))
  let x: number
  let z: number
  if (Math.abs(m[0][2]) < 0.9999999) {
    x = Math.atan2(-m[1][2], m[2][2])
    z = Math.atan2(-m[0][1], m[0][0])
  } else {
    x = Math.atan2(m[2][1], m[1][1])
    z = 0
  }
  return [x, y, z]
}

/** Apply an Euler XYZ rotation (R = Rx · Ry · Rz) to a vector. */
export function rotateVec(euler: Vec3, v: Vec3): Vec3 {
  const [rx, ry, rz] = euler
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)]
  // Rz first
  const x1 = cz * v[0] - sz * v[1]
  const y1 = sz * v[0] + cz * v[1]
  const z1 = v[2]
  // then Ry
  const x2 = cy * x1 + sy * z1
  const z2 = -sy * x1 + cy * z1
  // then Rx
  const y3 = cx * y1 - sx * z2
  const z3 = sx * y1 + cx * z2
  return [x2, y3, z3]
}

/** The inverse of rotateVec: world-space direction → part-local direction. */
export function inverseRotateVec(euler: Vec3, v: Vec3): Vec3 {
  const [rx, ry, rz] = euler
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(-rx), Math.sin(-rx), Math.cos(-ry), Math.sin(-ry), Math.cos(-rz), Math.sin(-rz)]
  // R = Rx·Ry·Rz, so R⁻¹ applies Rx⁻¹ first, then Ry⁻¹, then Rz⁻¹.
  const y1 = cx * v[1] - sx * v[2]
  const z1 = sx * v[1] + cx * v[2]
  const x2 = cy * v[0] + sy * z1
  const z2 = -sy * v[0] + cy * z1
  const x3 = cz * x2 - sz * y1
  const y3 = sz * x2 + cz * y1
  return [x3, y3, z2]
}
