import { describe, it, expect } from "vitest"
import { buildBox } from "./index"
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
import type { LeafSide, LidPosition, Part, Vec3 } from "./types"

const W = inToMm(18)
const D = inToMm(12)
const H = inToMm(10)
const T = 18

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const lidsOf = (lid: LidPosition, lidType: "full" | "split" | "half", openLeaf: LeafSide = "right") =>
  buildBox(inputs({ lidPosition: lid, lidType, openLeaf })).parts.filter((p) => p.type === "lid")
const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6))

const POSITIONS: LidPosition[] = ["top", "front"]

describe.each(POSITIONS)("%s lid", (lid) => {
  const outer = lid === "top" ? { axis: 1, value: H } : { axis: 2, value: D }

  describe("full", () => {
    it("is one part named Lid spanning the slab", () => {
      const parts = lidsOf(lid, "full")
      expect(parts).toHaveLength(1)
      expect(parts[0].name).toBe("Lid")
      close(lo(parts[0]), lid === "top" ? [0, H - T, 0] : [0, 0, D - T])
      close(hi(parts[0]), [W, H, D])
    })

    it(`hinge on ${lid === "top" ? "back" : "left"} edge, on the outer surface`, () => {
      const [p] = lidsOf(lid, "full")
      const h = p.hinge!
      expect(h).toBeDefined()
      expect(h.edge).toBe(lid === "top" ? "back" : "left")
      expect(h.from[outer.axis]).toBeCloseTo(outer.value, 6)
      expect(h.to[outer.axis]).toBeCloseTo(outer.value, 6)
      if (lid === "top") {
        close(h.from, [0, H, 0])
        close(h.to, [W, H, 0])
      } else {
        close(h.from, [0, 0, D])
        close(h.to, [0, H, D])
      }
    })
  })

  describe("split", () => {
    it("two equal 'Lid leaf' parts tiling the slab", () => {
      const parts = lidsOf(lid, "split")
      expect(parts).toHaveLength(2)
      expect(parts.every((p) => p.name === "Lid leaf")).toBe(true)
      const [a, b] = [...parts].sort((x, y) => x.center[0] - y.center[0])
      expect(a.extents[0]).toBeCloseTo(W / 2, 6)
      expect(b.extents[0]).toBeCloseTo(W / 2, 6)
      expect(lo(a)[0]).toBeCloseTo(0, 6)
      expect(hi(a)[0]).toBeCloseTo(lo(b)[0], 6)
      expect(hi(b)[0]).toBeCloseTo(W, 6)
      for (const i of [1, 2]) {
        expect(lo(a)[i]).toBeCloseTo(lo(b)[i], 6)
        expect(hi(a)[i]).toBeCloseTo(hi(b)[i], 6)
      }
      expect(a.length).toBeCloseTo(b.length, 6)
      expect(a.width).toBeCloseTo(b.width, 6)
      expect(a.thickness).toBeCloseTo(T, 6)
      expect(a.extents[1] * a.extents[2] * 2 * a.extents[0]).toBeCloseTo(
        lid === "top" ? W * T * D : W * H * T,
        0,
      )
    })

    it("left leaf hinged on left, right leaf on right, on the outer edge/surface", () => {
      const [a, b] = [...lidsOf(lid, "split")].sort((x, y) => x.center[0] - y.center[0])
      expect(a.hinge!.edge).toBe("left")
      expect(b.hinge!.edge).toBe("right")
      for (const [p, x] of [[a, 0], [b, W]] as const) {
        const h = p.hinge!
        expect(h.from[0]).toBeCloseTo(x, 6)
        expect(h.to[0]).toBeCloseTo(x, 6)
        expect(h.from[outer.axis]).toBeCloseTo(outer.value, 6)
        expect(h.to[outer.axis]).toBeCloseTo(outer.value, 6)
        // runs the full length of the leaf's outer edge
        const other = lid === "top" ? 2 : 1
        expect(Math.min(h.from[other], h.to[other])).toBeCloseTo(lo(p)[other], 6)
        expect(Math.max(h.from[other], h.to[other])).toBeCloseTo(hi(p)[other], 6)
      }
    })
  })

  describe("half", () => {
    it.each(["left", "right"] as const)("openLeaf %s: opening half hinged on its outer edge, fixed half not", (openLeaf) => {
      const parts = lidsOf(lid, "half", openLeaf)
      expect(parts.map((p) => p.name).sort()).toEqual(["Lid (fixed half)", "Lid (opening half)"])
      const opening = parts.find((p) => p.name === "Lid (opening half)")!
      const fixed = parts.find((p) => p.name === "Lid (fixed half)")!

      expect(opening.extents[0]).toBeCloseTo(W / 2, 6)
      expect(fixed.extents[0]).toBeCloseTo(W / 2, 6)
      expect(opening.length).toBeCloseTo(fixed.length, 6)
      expect(opening.width).toBeCloseTo(fixed.width, 6)

      // which side is which
      if (openLeaf === "left") {
        expect(opening.center[0]).toBeLessThan(W / 2)
        expect(fixed.center[0]).toBeGreaterThan(W / 2)
      } else {
        expect(opening.center[0]).toBeGreaterThan(W / 2)
        expect(fixed.center[0]).toBeLessThan(W / 2)
      }

      expect(fixed.hinge).toBeUndefined()
      const h = opening.hinge!
      expect(h.edge).toBe(openLeaf)
      const x = openLeaf === "left" ? 0 : W
      expect(h.from[0]).toBeCloseTo(x, 6)
      expect(h.to[0]).toBeCloseTo(x, 6)
      expect(h.from[outer.axis]).toBeCloseTo(outer.value, 6)
      expect(h.to[outer.axis]).toBeCloseTo(outer.value, 6)

      // tiles the slab
      const [a, b] = [...parts].sort((p, q) => p.center[0] - q.center[0])
      expect(lo(a)[0]).toBeCloseTo(0, 6)
      expect(hi(a)[0]).toBeCloseTo(lo(b)[0], 6)
      expect(hi(b)[0]).toBeCloseTo(W, 6)
    })

    it("swapping openLeaf swaps which half is opening", () => {
      const l = lidsOf(lid, "half", "left").find((p) => p.name === "Lid (opening half)")!
      const r = lidsOf(lid, "half", "right").find((p) => p.name === "Lid (opening half)")!
      expect(l.center[0] + r.center[0]).toBeCloseTo(W, 6)
      expect(l.center[0]).not.toBeCloseTo(r.center[0], 3)
    })
  })

  it("hinge endpoints lie within the lid part's bounds", () => {
    for (const lidType of ["full", "split", "half"] as const) {
      for (const p of lidsOf(lid, lidType, "left")) {
        if (!p.hinge) continue
        for (const pt of [p.hinge.from, p.hinge.to])
          for (let a = 0; a < 3; a++) {
            expect(pt[a]).toBeGreaterThanOrEqual(lo(p)[a] - 1e-6)
            expect(pt[a]).toBeLessThanOrEqual(hi(p)[a] + 1e-6)
          }
      }
    }
  })

  it("non-lid parts never have hinges", () => {
    const r = buildBox(inputs({ lidPosition: lid, lidType: "split" }))
    expect(r.parts.filter((p) => p.type !== "lid").every((p) => p.hinge === undefined)).toBe(true)
  })
})
