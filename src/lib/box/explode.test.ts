import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { centerOf, defaultExplodeDistance, explodeOffset, viewRadius } from "./explode"
import type { BoxInputs, BoxResult, Face, LidPosition, LidType, Part, Vec3 } from "./types"
import { inToMm } from "./units"

const inputs = (overrides: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  openLeaf: "right",
  legs: { face: null, height: 100, section: 38, inset: 12 },
  joinery: "butt",
  ...overrides,
})

const withLegs = (face: Face | null): BoxInputs["legs"] => ({ face, height: 100, section: 38, inset: 12 })

const LID_POSITIONS: LidPosition[] = ["top", "front"]
const LID_TYPES: LidType[] = ["full", "split", "half"]
const LEG_FACES_ALL: (Face | null)[] = [null, "bottom", "back", "left", "right"]

const centreOfExterior = (r: BoxResult): Vec3 => [r.exterior.w / 2, r.exterior.h / 2, r.exterior.d / 2]

const DISTANCE = 40

const nonZero = (v: Vec3) => v.filter((c) => c !== 0)

/** Expected unit direction (axis, sign) for a part. */
function expectedDir(part: Part, lid: LidPosition, legFace: Face | null): [number, 1 | -1] {
  switch (part.id) {
    case "left":
      return [0, -1]
    case "right":
      return [0, 1]
    case "back":
      return [2, -1]
    case "front":
      return [2, 1]
    case "bottom":
      return [1, -1]
    case "top":
      return [1, 1]
  }
  if (part.type === "lid") return lid === "top" ? [1, 1] : [2, 1]
  if (part.type === "leg") {
    const map: Record<Face, [number, 1 | -1]> = {
      bottom: [1, -1],
      top: [1, 1],
      back: [2, -1],
      front: [2, 1],
      left: [0, -1],
      right: [0, 1],
    }
    return map[legFace!]
  }
  throw new Error(`unexpected part ${part.id}`)
}

describe("explodeOffset", () => {
  for (const lidPosition of LID_POSITIONS) {
    for (const lidType of LID_TYPES) {
      for (const face of LEG_FACES_ALL) {
        if (face === lidPosition) continue
        const label = `lid ${lidPosition}/${lidType}, legs ${face ?? "none"}`
        const result = buildBox(inputs({ lidPosition, lidType, legs: withLegs(face) }))

        it(`builds a valid box (${label})`, () => {
          expect(result.ok).toBe(true)
          expect(result.parts.length).toBeGreaterThan(0)
        })

        it(`moves every part along exactly one axis by the distance (${label})`, () => {
          const c = centreOfExterior(result)
          for (const part of result.parts) {
            const off = explodeOffset(part, c, DISTANCE)
            expect(nonZero(off), part.id).toHaveLength(1)
            expect(Math.abs(nonZero(off)[0]), part.id).toBe(DISTANCE)
          }
        })

        it(`moves every part away from the centre in the right direction (${label})`, () => {
          const c = centreOfExterior(result)
          for (const part of result.parts) {
            const off = explodeOffset(part, c, DISTANCE)
            const [axis, sign] = expectedDir(part, lidPosition, face)
            expect(off[axis], part.id).toBe(sign * DISTANCE)
          }
        })
      }
    }
  }

  it("pushes the top panel of a front-lid box up", () => {
    const r = buildBox(inputs({ lidPosition: "front" }))
    const top = r.parts.find((p) => p.id === "top")!
    expect(explodeOffset(top, centreOfExterior(r), 10)).toEqual([0, 10, 0])
  })

  it("returns zero distance as all zeros (no NaN)", () => {
    const r = buildBox(inputs())
    for (const p of r.parts) {
      expect(explodeOffset(p, centreOfExterior(r), 0).map(Math.abs)).toEqual([0, 0, 0])
    }
  })
})

describe("centerOf", () => {
  it("returns the midpoint of a box", () => {
    expect(centerOf({ min: [0, 2, -4], max: [10, 4, 4] })).toEqual([5, 3, 0])
  })

  it("matches the exterior centre for a built box without legs", () => {
    const r = buildBox(inputs())
    const c = centerOf(r.bounds)
    const e = centreOfExterior(r)
    for (let a = 0; a < 3; a++) expect(c[a]).toBeCloseTo(e[a], 2)
  })
})

describe("viewRadius", () => {
  const cube = { min: [0, 0, 0] as Vec3, max: [2, 2, 2] as Vec3 }

  it("is half the diagonal of the bounds", () => {
    expect(viewRadius(cube)).toBeCloseTo(Math.sqrt(3), 10)
  })

  it("adds the explode distance", () => {
    expect(viewRadius(cube, 5)).toBeCloseTo(Math.sqrt(3) + 5, 10)
  })
})

describe("defaultExplodeDistance", () => {
  it("is half the smallest exterior dimension", () => {
    expect(defaultExplodeDistance({ w: 100, d: 60, h: 80 })).toBe(30)
    expect(defaultExplodeDistance({ w: 20, d: 60, h: 80 })).toBe(10)
    expect(defaultExplodeDistance({ w: 100, d: 60, h: 8 })).toBe(4)
  })

  it("uses the real exterior of a built box", () => {
    const r = buildBox(inputs())
    expect(defaultExplodeDistance(r.exterior)).toBeCloseTo(inToMm(10) / 2, 6)
  })
})

describe("exploded overlaps", () => {
  const TOL = 1e-4
  type Aabb = { lo: Vec3; hi: Vec3 }
  const aabb = (p: Part, off: Vec3 = [0, 0, 0]): Aabb => ({
    lo: [0, 1, 2].map((a) => p.center[a] + off[a] - p.extents[a] / 2) as Vec3,
    hi: [0, 1, 2].map((a) => p.center[a] + off[a] + p.extents[a] / 2) as Vec3,
  })
  const overlaps = (a: Aabb, b: Aabb) =>
    [0, 1, 2].every((i) => a.lo[i] < b.hi[i] - TOL && b.lo[i] < a.hi[i] - TOL)

  it("does not create new overlaps in the default top-lid full box", () => {
    const r = buildBox(inputs())
    const c = centreOfExterior(r)
    const dist = defaultExplodeDistance(r.exterior)
    const offsets = r.parts.map((p) => explodeOffset(p, c, dist))
    for (let i = 0; i < r.parts.length; i++) {
      for (let j = i + 1; j < r.parts.length; j++) {
        const before = overlaps(aabb(r.parts[i]), aabb(r.parts[j]))
        const after = overlaps(aabb(r.parts[i], offsets[i]), aabb(r.parts[j], offsets[j]))
        if (!before) {
          expect(after, `${r.parts[i].id} vs ${r.parts[j].id}`).toBe(false)
        }
      }
    }
  })
})
