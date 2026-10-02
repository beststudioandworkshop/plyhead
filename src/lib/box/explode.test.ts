import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { centerOf, defaultExplodeDistance, explodeOffset, viewRadius } from "./explode"
import type { BoxInputs, BoxResult, LegStyle, LidPosition, LidType, Part, Vec3 } from "./types"
import { inToMm } from "./units"

const inputs = (overrides: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  hingeSide: "long",
  openLeaf: "second",
  legs: { style: "none", height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  bottomStyle: "inset",
  dividers: 0,
  joinery: "butt",
  ...overrides,
})

const withLegs = (style: LegStyle): BoxInputs["legs"] => ({
  style,
  height: 100,
  diameter: 38,
  inset: 12,
  width: 76,
  footWidth: 38,
})

const LID_POSITIONS: LidPosition[] = ["top", "front"]
const LID_TYPES: LidType[] = ["full", "split", "half"]
const LEG_STYLES: LegStyle[] = ["none", "dowel", "tapered"]

const centreOfExterior = (r: BoxResult): Vec3 => [r.exterior.w / 2, r.exterior.h / 2, r.exterior.d / 2]

const DISTANCE = 40

const nonZero = (v: Vec3) => v.filter((c) => c !== 0)

/** Expected unit direction (axis, sign) for a part. */
function expectedDir(part: Part, lid: LidPosition, centre: Vec3): [number, 1 | -1] {
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
  if (part.type === "divider") {
    const axis = [0, 1, 2].reduce((best, a) => (part.extents[a] < part.extents[best] ? a : best), 0)
    return [axis, part.center[axis] >= centre[axis] ? 1 : -1]
  }
  if (part.type === "lid") return lid === "top" ? [1, 1] : [2, 1]
  // Legs always drop straight down.
  if (part.type === "leg") return [1, -1]
  throw new Error(`unexpected part ${part.id}`)
}

describe("explodeOffset", () => {
  for (const lidPosition of LID_POSITIONS) {
    for (const lidType of LID_TYPES) {
      for (const style of LEG_STYLES) {
       for (const dividers of lidType === "full" ? [0, 2] : [0, 1, 3]) {
        const label = `lid ${lidPosition}/${lidType}, legs ${style}, dividers ${dividers}`
        const result = buildBox(inputs({ lidPosition, lidType, dividers, legs: withLegs(style) }))

        it(`builds a valid box (${label})`, () => {
          expect(result.ok).toBe(true)
          expect(result.parts.length).toBeGreaterThan(0)
        })

        it(`moves every part along exactly one axis by the distance (${label})`, () => {
          const c = centreOfExterior(result)
          for (const part of result.parts.filter((x) => x.type !== "divider")) {
            const off = explodeOffset(part, c, DISTANCE)
            expect(nonZero(off), part.id).toHaveLength(1)
            expect(Math.abs(nonZero(off)[0]), part.id).toBe(DISTANCE)
          }
        })

        it(`moves every part away from the centre in the right direction (${label})`, () => {
          const c = centreOfExterior(result)
          for (const part of result.parts.filter((x) => x.type !== "divider")) {
            const off = explodeOffset(part, c, DISTANCE)
            const [axis, sign] = expectedDir(part, lidPosition, c)
            expect(off[axis], part.id).toBe(sign * DISTANCE)
          }
        })

        it(`dividers stay put at [0, 0, 0] (${label})`, () => {
          const c = centreOfExterior(result)
          const divs = result.parts.filter((x) => x.type === "divider")
          expect(divs).toHaveLength(dividers)
          for (const part of divs) {
            expect(explodeOffset(part, c, DISTANCE), part.id).toEqual([0, 0, 0])
            expect(explodeOffset(part, [1e6, -1e6, 0], DISTANCE), part.id).toEqual([0, 0, 0])
          }
        })
       }
      }
    }
  }

  it("legs always go exactly [0, -distance, 0], wherever they are", () => {
    for (const style of ["dowel", "tapered"] as const) {
      const r = buildBox(inputs({ legs: withLegs(style) }))
      const legs = r.parts.filter((p) => p.type === "leg")
      expect(legs).toHaveLength(style === "dowel" ? 4 : 8)
      for (const p of legs) {
        expect(explodeOffset(p, centreOfExterior(r), DISTANCE)).toEqual([0, -DISTANCE, 0])
        // even for a centre that would otherwise point sideways
        expect(explodeOffset(p, [0, -1000, 0], DISTANCE)).toEqual([0, -DISTANCE, 0])
        expect(explodeOffset(p, [1e6, 0, 1e6], DISTANCE)).toEqual([0, -DISTANCE, 0])
      }
    }
  })

  it("non-leg parts still move along their thinnest axis, away from the centre", () => {
    const r = buildBox(inputs({ legs: withLegs("tapered") }))
    const c = centreOfExterior(r)
    for (const p of r.parts.filter((x) => x.type !== "leg" && x.type !== "divider")) {
      const axis = [0, 1, 2].reduce((best, a) => (p.extents[a] < p.extents[best] ? a : best), 0)
      const off = explodeOffset(p, c, DISTANCE)
      expect(off[axis]).toBe(p.center[axis] >= c[axis] ? DISTANCE : -DISTANCE)
    }
  })

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

  const cases: [LidPosition, LegStyle, number][] = []
  for (const lp of LID_POSITIONS)
    for (const st of LEG_STYLES) for (const dv of [0, 1, 3]) cases.push([lp, st, dv])

  it.each([2, 3] as const)("front-lid shelves explode without new overlaps (%i shelves, all lid types)", (dividers) => {
    for (const lidType of LID_TYPES) {
      const r = buildBox(inputs({ lidPosition: "front", lidType, dividers }))
      expect(r.ok).toBe(true)
      const c = centreOfExterior(r)
      const dist = defaultExplodeDistance(r.exterior)
      const offsets = r.parts.map((p) => explodeOffset(p, c, dist))
      for (let i = 0; i < r.parts.length; i++)
        for (let j = i + 1; j < r.parts.length; j++) {
          if (overlaps(aabb(r.parts[i]), aabb(r.parts[j]))) continue
          expect(overlaps(aabb(r.parts[i], offsets[i]), aabb(r.parts[j], offsets[j])), `${lidType} ${r.parts[i].id} vs ${r.parts[j].id}`).toBe(false)
        }
    }
  })

  it.each(cases)("does not create new overlaps (%s lid, legs %s, %i dividers)", (lidPosition, style, dividers) => {
    const r = buildBox(inputs({ lidPosition, dividers, legs: withLegs(style) }))
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
