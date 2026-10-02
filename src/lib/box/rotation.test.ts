import { describe, it, expect } from "vitest"
import { boxCenter, boxSize, eulerFromAxes, rotateVec } from "./rotation"
import type { Axis, Vec3 } from "./types"

const unit = (a: Axis): Vec3 => {
  const v: Vec3 = [0, 0, 0]
  v[a] = 1
  return v
}
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const expectVec = (actual: Vec3, expected: Vec3) => {
  for (let i = 0; i < 3; i++) expect(actual[i]).toBeCloseTo(expected[i], 9)
}

const PERMS: [Axis, Axis, Axis][] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

describe("eulerFromAxes", () => {
  it.each(PERMS)("permutation (%i, %i, %i) is a proper rotation onto the right axes", (l, t, w) => {
    const e = eulerFromAxes(l, t, w)
    expect(e.every(Number.isFinite)).toBe(true)
    const rx = rotateVec(e, [1, 0, 0])
    const ry = rotateVec(e, [0, 1, 0])
    const rz = rotateVec(e, [0, 0, 1])
    expectVec(rx, unit(l))
    expectVec(ry, unit(t))
    // width axis: up to sign
    expect(Math.abs(rz[w])).toBeCloseTo(1, 9)
    for (let i = 0; i < 3; i++) if (i !== w) expect(rz[i]).toBeCloseTo(0, 9)
    // proper rotation (no reflection): x cross y = z
    expectVec(cross(rx, ry), rz)
  })

  it("identity for (0,1,2)", () => {
    const e = eulerFromAxes(0, 1, 2)
    e.forEach((v) => expect(v).toBeCloseTo(0, 9))
  })

  it("preserves vector length", () => {
    for (const [l, t, w] of PERMS) {
      const r = rotateVec(eulerFromAxes(l, t, w), [3, 4, 12])
      expect(Math.hypot(...r)).toBeCloseTo(13, 9)
    }
  })

  it("maps a (length, thickness, width) vector to world extents", () => {
    for (const [l, t, w] of PERMS) {
      const r = rotateVec(eulerFromAxes(l, t, w), [30, 2, 10])
      expect(Math.abs(r[l])).toBeCloseTo(30, 9)
      expect(Math.abs(r[t])).toBeCloseTo(2, 9)
      expect(Math.abs(r[w])).toBeCloseTo(10, 9)
    }
  })
})

describe("box helpers", () => {
  it("boxSize and boxCenter", () => {
    const b = { min: [1, 2, 3] as Vec3, max: [5, 8, 13] as Vec3 }
    expect(boxSize(b)).toEqual([4, 6, 10])
    expect(boxCenter(b)).toEqual([3, 5, 8])
  })
})
