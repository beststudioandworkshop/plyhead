import { describe, it, expect } from "vitest"
import { buildBox, resolveDimensions } from "./index"
import { rotateVec } from "./rotation"
import type { BoxInputs } from "./types"
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
import type { BoxResult, LidPosition, LidType, Part, Vec3 } from "./types"

const W = inToMm(18)
const D = inToMm(12)
const H = inToMm(10)
const T = 18
const EPS = 1e-6

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const vol = (p: Part) => p.extents[0] * p.extents[1] * p.extents[2]
const names = (r: BoxResult) => r.parts.map((p) => p.name).sort()
const overlaps = (a: Part, b: Part) => {
  const [al, ah, bl, bh] = [lo(a), hi(a), lo(b), hi(b)]
  return [0, 1, 2].every((i) => Math.min(ah[i], bh[i]) - Math.max(al[i], bl[i]) > 1e-4)
}
const solid = (r: BoxResult) => r.parts.filter((p) => p.type !== "leg")

describe("interior <-> exterior", () => {
  const thicknesses = [inToMm(0.47), inToMm(0.71), 12, 18, 7.3]
  const lids: LidPosition[] = ["top", "front"]
  const interior = { w: 300.5, d: 200.25, h: 150 }

  for (const lidPosition of lids) {
    for (const thickness of thicknesses) {
      it(`${lidPosition} lid, t=${thickness.toFixed(2)}: exterior = interior + clearance + 2t`, () => {
        const c = 4.5
        const r = buildBox(
          inputs({ dimensionMode: "interior", dims: interior, clearance: c, thickness, lidPosition }),
        )
        expect(r.ok).toBe(true)
        expect(r.exterior.w).toBeCloseTo(interior.w + c + 2 * thickness, 9)
        expect(r.exterior.d).toBeCloseTo(interior.d + c + 2 * thickness, 9)
        expect(r.exterior.h).toBeCloseTo(interior.h + c + 2 * thickness, 9)
        expect(r.interior.w).toBeCloseTo(interior.w + c, 9)
        expect(r.interior.d).toBeCloseTo(interior.d + c, 9)
        expect(r.interior.h).toBeCloseTo(interior.h + c, 9)
      })

      it(`${lidPosition} lid, t=${thickness.toFixed(2)}: zero clearance gives interior + 2t`, () => {
        const r = buildBox(
          inputs({ dimensionMode: "interior", dims: interior, clearance: 0, thickness, lidPosition }),
        )
        expect(r.exterior.w).toBeCloseTo(interior.w + 2 * thickness, 9)
        expect(r.exterior.d).toBeCloseTo(interior.d + 2 * thickness, 9)
        expect(r.exterior.h).toBeCloseTo(interior.h + 2 * thickness, 9)
        expect(r.interior).toEqual(interior)
      })

      it(`${lidPosition} lid, t=${thickness.toFixed(2)}: exterior mode interior = exterior - 2t`, () => {
        const r = buildBox(inputs({ thickness, lidPosition }))
        expect(r.exterior).toEqual({ w: W, d: D, h: H })
        expect(r.interior.w).toBeCloseTo(W - 2 * thickness, 9)
        expect(r.interior.d).toBeCloseTo(D - 2 * thickness, 9)
        expect(r.interior.h).toBeCloseTo(H - 2 * thickness, 9)
      })

      it(`${lidPosition} lid, t=${thickness.toFixed(2)}: round trip returns interior + clearance`, () => {
        const c = 3.175
        const first = buildBox(
          inputs({ dimensionMode: "interior", dims: interior, clearance: c, thickness, lidPosition }),
        )
        const second = buildBox(
          inputs({ dimensionMode: "exterior", dims: first.exterior, thickness, lidPosition }),
        )
        expect(second.interior.w).toBeCloseTo(interior.w + c, 9)
        expect(second.interior.d).toBeCloseTo(interior.d + c, 9)
        expect(second.interior.h).toBeCloseTo(interior.h + c, 9)
      })
    }
  }

  it("resolveDimensions agrees with buildBox", () => {
    const i = inputs({ dimensionMode: "interior", dims: interior })
    const { exterior, interior: inner } = resolveDimensions(i)
    const r = buildBox(i)
    expect(r.exterior).toEqual(exterior)
    expect(r.interior).toEqual(inner)
  })
})

describe("part sets", () => {
  it("top lid: side x2, back, front, bottom, lid; no top part", () => {
    const r = buildBox(inputs())
    expect(r.ok).toBe(true)
    expect(names(r)).toEqual(["Back", "Bottom", "Front", "Lid", "Side", "Side"])
    expect(r.parts.some((p) => p.type === "top")).toBe(false)
    expect(r.parts.filter((p) => p.type === "side")).toHaveLength(2)
  })

  it("front lid: side x2, back, top, bottom, lid; no front part", () => {
    const r = buildBox(inputs({ lidPosition: "front" }))
    expect(r.ok).toBe(true)
    expect(names(r)).toEqual(["Back", "Bottom", "Lid", "Side", "Side", "Top"])
    expect(r.parts.some((p) => p.type === "front")).toBe(false)
  })

  const dimsOf = (p: Part) => [p.length, p.width, p.thickness]

  it("top lid cut dimensions", () => {
    const r = buildBox(inputs())
    for (const s of r.parts.filter((p) => p.type === "side")) {
      expect(dimsOf(s)[0]).toBeCloseTo(D, 6)
      expect(dimsOf(s)[1]).toBeCloseTo(H - T, 6)
      expect(dimsOf(s)[2]).toBeCloseTo(T, 6)
    }
    for (const type of ["front", "back"] as const) {
      const p = r.parts.find((x) => x.type === type)!
      expect(dimsOf(p)[0]).toBeCloseTo(W - 2 * T, 6)
      expect(dimsOf(p)[1]).toBeCloseTo(H - T, 6)
      expect(p.thickness).toBeCloseTo(T, 6)
    }
    const bottom = r.parts.find((x) => x.type === "bottom")!
    expect(bottom.length).toBeCloseTo(W - 2 * T, 6)
    expect(bottom.width).toBeCloseTo(D - 2 * T, 6)
    expect(bottom.thickness).toBeCloseTo(T, 6)
    const lid = r.parts.find((x) => x.type === "lid")!
    expect(lid.length).toBeCloseTo(W, 6)
    expect(lid.width).toBeCloseTo(D, 6)
    expect(lid.thickness).toBeCloseTo(T, 6)
  })

  it("front lid cut dimensions", () => {
    const r = buildBox(inputs({ lidPosition: "front" }))
    for (const s of r.parts.filter((p) => p.type === "side")) {
      expect(s.length).toBeCloseTo(D - T, 6)
      expect(s.width).toBeCloseTo(H, 6)
      expect(s.thickness).toBeCloseTo(T, 6)
    }
    const back = r.parts.find((x) => x.type === "back")!
    expect(back.length).toBeCloseTo(W - 2 * T, 6)
    expect(back.width).toBeCloseTo(H, 6)
    for (const type of ["top", "bottom"] as const) {
      const p = r.parts.find((x) => x.type === type)!
      expect(p.length).toBeCloseTo(W - 2 * T, 6)
      expect(p.width).toBeCloseTo(D - 2 * T, 6)
      expect(p.thickness).toBeCloseTo(T, 6)
    }
    const lid = r.parts.find((x) => x.type === "lid")!
    expect(lid.length).toBeCloseTo(W, 6)
    expect(lid.width).toBeCloseTo(H, 6)
    expect(lid.thickness).toBeCloseTo(T, 6)
  })

  it("length >= width for every non-leg part, and cut dims are positive", () => {
    for (const lidPosition of ["top", "front"] as const) {
      for (const p of solid(buildBox(inputs({ lidPosition })))) {
        expect(p.length).toBeGreaterThanOrEqual(p.width)
        expect(p.width).toBeGreaterThan(0)
        expect(p.thickness).toBeGreaterThan(0)
      }
    }
  })
})

describe("assembly validity", () => {
  const combos: [LidPosition, LidType, "left" | "right"][] = []
  for (const lp of ["top", "front"] as const)
    for (const lt of ["full", "split", "half"] as const)
      for (const ol of ["left", "right"] as const) combos.push([lp, lt, ol])

  it.each(combos)("%s lid, %s, openLeaf %s: rotation, bounds, overlap, volume", (lidPosition, lidType, openLeaf) => {
    const r = buildBox(inputs({ lidPosition, lidType, openLeaf }))
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])

    for (const p of r.parts) {
      const rv = rotateVec(p.rotation, [p.length, p.thickness, p.width])
      for (let a = 0; a < 3; a++) {
        expect(Math.abs(rv[a])).toBeCloseTo(p.extents[a], 2)
      }
      expect(p.grain).toBeNull()
    }

    for (const p of r.parts) {
      const [l, h] = [lo(p), hi(p)]
      expect(l[0]).toBeGreaterThanOrEqual(-EPS)
      expect(l[1]).toBeGreaterThanOrEqual(-EPS)
      expect(l[2]).toBeGreaterThanOrEqual(-EPS)
      expect(h[0]).toBeLessThanOrEqual(W + EPS)
      expect(h[1]).toBeLessThanOrEqual(H + EPS)
      expect(h[2]).toBeLessThanOrEqual(D + EPS)
    }

    const parts = r.parts
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++)
        expect(overlaps(parts[i], parts[j]), `${parts[i].id} vs ${parts[j].id}`).toBe(false)

    const total = parts.reduce((s, p) => s + vol(p), 0)
    const ext = W * D * H
    const inn = r.interior.w * r.interior.d * r.interior.h
    expect(total).toBeCloseTo(ext - inn, 0)
    // cut dimensions agree with extents volume
    const cutVol = parts.reduce((s, p) => s + p.length * p.width * p.thickness, 0)
    expect(cutVol).toBeCloseTo(total, 0)

    expect(r.bounds.min).toEqual([0, 0, 0])
    expect(r.bounds.max[0]).toBeCloseTo(W, 2)
    expect(r.bounds.max[1]).toBeCloseTo(H, 2)
    expect(r.bounds.max[2]).toBeCloseTo(D, 2)
  })

  it("works for several thicknesses", () => {
    for (const thickness of [inToMm(0.47), inToMm(0.71), 12, 18]) {
      const r = buildBox(inputs({ thickness }))
      const total = r.parts.reduce((s, p) => s + vol(p), 0)
      expect(total).toBeCloseTo(W * D * H - r.interior.w * r.interior.d * r.interior.h, 0)
    }
  })
})

describe("validation", () => {
  const bad = (r: BoxResult, code: string) => {
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain(code)
    expect(r.parts).toEqual([])
    expect(r.exterior).toBeDefined()
    expect(r.interior).toBeDefined()
  }

  it.each([
    ["zero width", { w: 0, d: 100, h: 100 }],
    ["zero depth", { w: 100, d: 0, h: 100 }],
    ["zero height", { w: 100, d: 100, h: 0 }],
    ["negative width", { w: -5, d: 100, h: 100 }],
    ["negative height", { w: 100, d: 100, h: -1 }],
    ["NaN depth", { w: 100, d: NaN, h: 100 }],
    ["Infinity width", { w: Infinity, d: 100, h: 100 }],
  ])("%s -> non-positive-dimension", (_n, dims) => {
    bad(buildBox(inputs({ dims })), "non-positive-dimension")
  })

  it("zero / negative / NaN thickness -> non-positive-thickness", () => {
    for (const thickness of [0, -3, NaN]) bad(buildBox(inputs({ thickness })), "non-positive-thickness")
  })

  it("returns exterior and interior on failure", () => {
    const r = buildBox(inputs({ thickness: 0 }))
    expect(r.exterior).toEqual({ w: W, d: D, h: H })
    expect(r.interior).toEqual({ w: W, d: D, h: H })
    const r2 = buildBox(inputs({ dims: { w: 20, d: 100, h: 100 }, thickness: 18 }))
    expect(r2.exterior).toEqual({ w: 20, d: 100, h: 100 })
    expect(r2.interior.w).toBeCloseTo(-16, 9)
  })

  it("exterior smaller than (or equal to) 2t -> interior-too-small", () => {
    bad(buildBox(inputs({ dims: { w: 36, d: 200, h: 200 } })), "interior-too-small")
    bad(buildBox(inputs({ dims: { w: 30, d: 200, h: 200 } })), "interior-too-small")
    bad(buildBox(inputs({ dims: { w: 200, d: 35, h: 200 } })), "interior-too-small")
    bad(buildBox(inputs({ dims: { w: 200, d: 200, h: 10 } })), "interior-too-small")
    bad(buildBox(inputs({ dims: { w: 200, d: 200, h: 36 } })), "interior-too-small")
  })

  it("just above 2t is fine", () => {
    expect(buildBox(inputs({ dims: { w: 36.5, d: 200, h: 200 } })).ok).toBe(true)
  })

  it("interior mode with enough negative clearance -> interior-too-small", () => {
    bad(
      buildBox(inputs({ dimensionMode: "interior", dims: { w: 10, d: 100, h: 100 }, clearance: -20 })),
      "interior-too-small",
    )
  })

  it("ok results have no issues and a non-empty parts list", () => {
    const r = buildBox(inputs())
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
    expect(r.parts.length).toBeGreaterThan(0)
  })
})

describe("determinism", () => {
  it("building twice gives deep-equal results", () => {
    const i = inputs({ lidType: "half", legs: { face: "bottom", height: 100, section: 38, inset: 12 } })
    expect(buildBox(i)).toEqual(buildBox(i))
    expect(buildBox(i)).toEqual(buildBox(structuredClone(i)))
  })

  it("does not mutate its inputs", () => {
    const i = inputs({ legs: { face: "bottom", height: 100, section: 38, inset: 12 } })
    const copy = structuredClone(i)
    buildBox(i)
    expect(i).toEqual(copy)
  })

  it("grain is null and ids are unique across configurations", () => {
    for (const lidPosition of ["top", "front"] as const)
      for (const lidType of ["full", "split", "half"] as const)
        for (const face of [null, "bottom", "left"] as const) {
          const r = buildBox(inputs({ lidPosition, lidType, legs: { face, height: 100, section: 38, inset: 12 } }))
          expect(r.ok).toBe(true)
          const ids = r.parts.map((p) => p.id)
          expect(new Set(ids).size).toBe(ids.length)
          expect(r.parts.every((p) => p.grain === null)).toBe(true)
        }
  })
})
