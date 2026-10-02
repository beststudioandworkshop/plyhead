import { describe, it, expect } from "vitest"
import { buildBox, lidAxes } from "./index"
import type { Axis, BoxInputs, HingeEdge, HingeSide, LeafSide, LidPosition, LidType, Part, Vec3 } from "./types"
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

const T = 18
const LIDS: LidPosition[] = ["top", "front"]
const TYPES: LidType[] = ["full", "split", "half"]
const SIDES: HingeSide[] = ["long", "short"]
const LEAVES: LeafSide[] = ["first", "second"]

const EDGE_NAME: Record<Axis, [HingeEdge["edge"], HingeEdge["edge"]]> = {
  0: ["left", "right"],
  1: ["bottom", "top"],
  2: ["back", "front"],
}

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 2)

interface Case {
  label: string
  dims: { w: number; d: number; h: number }
  lid: LidPosition
  /** Expected hinge axis for each hingeSide. */
  axes: Record<HingeSide, { hinge: Axis; cross: Axis }>
}

const W = inToMm(18)
const D = inToMm(12)
const H = inToMm(10)

const CASES: Case[] = [
  {
    label: "18x12x10in top lid",
    dims: { w: W, d: D, h: H },
    lid: "top",
    axes: { long: { hinge: 0, cross: 2 }, short: { hinge: 2, cross: 0 } },
  },
  {
    label: "18x12x10in front lid",
    dims: { w: W, d: D, h: H },
    lid: "front",
    axes: { long: { hinge: 0, cross: 1 }, short: { hinge: 1, cross: 0 } },
  },
  {
    label: "deep box 200x300x254 top lid (z is longer)",
    dims: { w: 200, d: 300, h: 254 },
    lid: "top",
    axes: { long: { hinge: 2, cross: 0 }, short: { hinge: 0, cross: 2 } },
  },
  {
    label: "tall box 200x254x300 front lid (y is longer)",
    dims: { w: 200, d: 254, h: 300 },
    lid: "front",
    axes: { long: { hinge: 1, cross: 0 }, short: { hinge: 0, cross: 1 } },
  },
  {
    label: "square top lid 300x300x254 (tie -> x is long)",
    dims: { w: 300, d: 300, h: 254 },
    lid: "top",
    axes: { long: { hinge: 0, cross: 2 }, short: { hinge: 2, cross: 0 } },
  },
  {
    label: "square front lid 300x254x300 (tie -> x is long)",
    dims: { w: 300, d: 254, h: 300 },
    lid: "front",
    axes: { long: { hinge: 0, cross: 1 }, short: { hinge: 1, cross: 0 } },
  },
]

describe("lidAxes", () => {
  it("top lid on 18x12x10in", () => {
    const size: Vec3 = [W, T, D]
    expect(lidAxes(size, "top", "long")).toEqual({
      normalAxis: 1,
      hingeAxis: 0,
      crossAxis: 2,
      hingeLength: W,
      crossLength: D,
    })
    expect(lidAxes(size, "top", "short")).toEqual({
      normalAxis: 1,
      hingeAxis: 2,
      crossAxis: 0,
      hingeLength: D,
      crossLength: W,
    })
  })

  it("front lid on 18x12x10in", () => {
    const size: Vec3 = [W, H, T]
    expect(lidAxes(size, "front", "long")).toEqual({
      normalAxis: 2,
      hingeAxis: 0,
      crossAxis: 1,
      hingeLength: W,
      crossLength: H,
    })
    expect(lidAxes(size, "front", "short")).toEqual({
      normalAxis: 2,
      hingeAxis: 1,
      crossAxis: 0,
      hingeLength: H,
      crossLength: W,
    })
  })

  it("a tie goes to the lower-index axis (x)", () => {
    expect(lidAxes([300, T, 300], "top", "long").hingeAxis).toBe(0)
    expect(lidAxes([300, T, 300], "top", "short").hingeAxis).toBe(2)
    expect(lidAxes([300, 300, T], "front", "long").hingeAxis).toBe(0)
    expect(lidAxes([300, 300, T], "front", "short").hingeAxis).toBe(1)
  })

  it("hinge and cross axes are always distinct in-plane axes", () => {
    for (const lid of LIDS)
      for (const side of SIDES) {
        const a = lidAxes([100, 200, 300], lid, side)
        expect(a.hingeAxis).not.toBe(a.crossAxis)
        expect(a.hingeAxis).not.toBe(a.normalAxis)
        expect(a.crossAxis).not.toBe(a.normalAxis)
      }
  })
})

describe.each(CASES)("$label", ({ dims, lid, axes }) => {
  const slabMin: Vec3 = lid === "top" ? [0, dims.h - T, 0] : [0, 0, dims.d - T]
  const slabMax: Vec3 = [dims.w, dims.h, dims.d]
  const normal: Axis = lid === "top" ? 1 : 2
  const inner = slabMin[normal]

  const lidsOf = (lidType: LidType, hingeSide: HingeSide, openLeaf: LeafSide) =>
    buildBox(inputs({ dims, lidPosition: lid, lidType, hingeSide, openLeaf })).parts.filter((p) => p.type === "lid")

  /** The hinge is a segment along the hinge axis, at `crossValue`, on the inside face of `leaf`. */
  const expectHinge = (leaf: Part, hinge: HingeEdge | undefined, hingeAxis: Axis, crossAxis: Axis, end: 0 | 1) => {
    expect(hinge).toBeDefined()
    const h = hinge!
    expect(h.edge).toBe(EDGE_NAME[crossAxis][end])
    const crossValue = end === 0 ? lo(leaf)[crossAxis] : hi(leaf)[crossAxis]
    for (const pt of [h.from, h.to]) {
      near(pt[crossAxis], crossValue)
      near(pt[normal], inner)
    }
    near(Math.min(h.from[hingeAxis], h.to[hingeAxis]), lo(leaf)[hingeAxis])
    near(Math.max(h.from[hingeAxis], h.to[hingeAxis]), hi(leaf)[hingeAxis])
    // endpoints lie within the leaf's bounds
    for (const pt of [h.from, h.to])
      for (let a = 0; a < 3; a++) {
        expect(pt[a]).toBeGreaterThanOrEqual(lo(leaf)[a] - 1e-2)
        expect(pt[a]).toBeLessThanOrEqual(hi(leaf)[a] + 1e-2)
      }
  }

  describe.each(SIDES)("hingeSide %s", (hingeSide) => {
    const { hinge: hingeAxis, cross: crossAxis } = axes[hingeSide]
    const mid = (slabMin[crossAxis] + slabMax[crossAxis]) / 2

    it("lidAxes matches the expected axes for this slab", () => {
      const size: Vec3 = [slabMax[0] - slabMin[0], slabMax[1] - slabMin[1], slabMax[2] - slabMin[2]]
      const a = lidAxes(size, lid, hingeSide)
      expect(a.hingeAxis).toBe(hingeAxis)
      expect(a.crossAxis).toBe(crossAxis)
      expect(a.normalAxis).toBe(normal)
      near(a.hingeLength, size[hingeAxis])
      near(a.crossLength, size[crossAxis])
    })

    it("full: one part named Lid, hinged at the min end of the cross axis", () => {
      const parts = lidsOf("full", hingeSide, "second")
      expect(parts).toHaveLength(1)
      const [p] = parts
      expect(p.name).toBe("Lid")
      for (let a = 0; a < 3; a++) {
        near(lo(p)[a], slabMin[a])
        near(hi(p)[a], slabMax[a])
      }
      expectHinge(p, p.hinge, hingeAxis, crossAxis, 0)
      near(p.hinge!.from[crossAxis], slabMin[crossAxis])
    })

    it("full: openLeaf is irrelevant", () => {
      expect(lidsOf("full", hingeSide, "first")).toEqual(lidsOf("full", hingeSide, "second"))
    })

    it("split: two 'Lid leaf' parts tiling the slab, each hinged on its outer cross end", () => {
      const parts = lidsOf("split", hingeSide, "second")
      expect(parts.map((p) => p.id)).toEqual(["lid-first", "lid-second"])
      expect(parts.every((p) => p.name === "Lid leaf")).toBe(true)
      const [first, second] = parts

      near(lo(first)[crossAxis], slabMin[crossAxis])
      near(hi(first)[crossAxis], mid)
      near(lo(second)[crossAxis], mid)
      near(hi(second)[crossAxis], slabMax[crossAxis])
      for (const leaf of parts)
        for (let a = 0; a < 3; a++) {
          if (a === crossAxis) continue
          near(lo(leaf)[a], slabMin[a])
          near(hi(leaf)[a], slabMax[a])
        }
      near(first.extents[crossAxis], second.extents[crossAxis])
      // total volume equals the slab
      const vol = parts.reduce((s, p) => s + p.extents[0] * p.extents[1] * p.extents[2], 0)
      const slab = (slabMax[0] - slabMin[0]) * (slabMax[1] - slabMin[1]) * (slabMax[2] - slabMin[2])
      expect(vol).toBeCloseTo(slab, 0)

      expectHinge(first, first.hinge, hingeAxis, crossAxis, 0)
      expectHinge(second, second.hinge, hingeAxis, crossAxis, 1)
      // the second leaf's hinge sits on the far (max) edge of the slab
      near(second.hinge!.from[crossAxis], slabMax[crossAxis])
      near(second.hinge!.to[crossAxis], slabMax[crossAxis])
      near(first.hinge!.from[crossAxis], slabMin[crossAxis])
    })

    it.each(LEAVES)("half, openLeaf %s: opening half is hinged, fixed half has no hinge", (openLeaf) => {
      const parts = lidsOf("half", hingeSide, openLeaf)
      expect(parts.map((p) => p.id)).toEqual(["lid-first", "lid-second"])
      const [first, second] = parts
      const opening = openLeaf === "first" ? first : second
      const fixed = openLeaf === "first" ? second : first
      expect(opening.name).toBe("Lid (opening half)")
      expect(fixed.name).toBe("Lid (fixed half)")

      // tiles the slab
      near(lo(first)[crossAxis], slabMin[crossAxis])
      near(hi(first)[crossAxis], lo(second)[crossAxis])
      near(hi(second)[crossAxis], slabMax[crossAxis])
      near(first.extents[crossAxis], second.extents[crossAxis])
      near(hi(first)[crossAxis], mid)

      expect(fixed.hinge).toBeUndefined()
      if (openLeaf === "first") {
        expectHinge(opening, opening.hinge, hingeAxis, crossAxis, 0)
        near(opening.hinge!.from[crossAxis], slabMin[crossAxis])
      } else {
        expectHinge(opening, opening.hinge, hingeAxis, crossAxis, 1)
        near(opening.hinge!.from[crossAxis], slabMax[crossAxis])
      }
    })

    it("swapping openLeaf swaps which half is opening", () => {
      const a = lidsOf("half", hingeSide, "first").find((p) => p.name === "Lid (opening half)")!
      const b = lidsOf("half", hingeSide, "second").find((p) => p.name === "Lid (opening half)")!
      near(a.center[crossAxis] + b.center[crossAxis], slabMin[crossAxis] + slabMax[crossAxis])
      expect(Math.abs(a.center[crossAxis] - b.center[crossAxis])).toBeGreaterThan(1)
    })
  })

  it("short and long hinge sides give different hinge directions", () => {
    const l = lidsOf("full", "long", "second")[0].hinge!
    const s = lidsOf("full", "short", "second")[0].hinge!
    const dir = (h: HingeEdge) => [0, 1, 2].find((a) => Math.abs(h.from[a] - h.to[a]) > 1e-6)
    expect(dir(l)).toBe(axes.long.hinge)
    expect(dir(s)).toBe(axes.short.hinge)
    expect(dir(l)).not.toBe(dir(s))
  })
})

describe("expected hinge edges on 18x12x10in", () => {
  const edge = (lidPosition: LidPosition, hingeSide: HingeSide) =>
    buildBox(inputs({ lidPosition, hingeSide })).parts.find((p) => p.type === "lid")!.hinge!.edge

  it("top lid", () => {
    expect(edge("top", "long")).toBe("back")
    expect(edge("top", "short")).toBe("left")
  })

  it("front lid", () => {
    expect(edge("front", "long")).toBe("bottom")
    expect(edge("front", "short")).toBe("left")
  })

  it("split leaves: second leaf hinges on the opposite edge", () => {
    const edges = (lidPosition: LidPosition, hingeSide: HingeSide) =>
      buildBox(inputs({ lidPosition, hingeSide, lidType: "split" }))
        .parts.filter((p) => p.type === "lid")
        .map((p) => p.hinge!.edge)
    expect(edges("top", "long")).toEqual(["back", "front"])
    expect(edges("top", "short")).toEqual(["left", "right"])
    expect(edges("front", "long")).toEqual(["bottom", "top"])
    expect(edges("front", "short")).toEqual(["left", "right"])
  })
})

describe("every combination", () => {
  const combos: [LidPosition, LidType, HingeSide, LeafSide][] = []
  for (const l of LIDS) for (const t of TYPES) for (const s of SIDES) for (const o of LEAVES) combos.push([l, t, s, o])

  it.each(combos)("%s %s %s %s: hinge endpoints on the lid, none on non-lid parts", (lidPosition, lidType, hingeSide, openLeaf) => {
    const r = buildBox(inputs({ lidPosition, lidType, hingeSide, openLeaf }))
    expect(r.ok).toBe(true)
    for (const p of r.parts) {
      if (p.type !== "lid") {
        expect(p.hinge).toBeUndefined()
        continue
      }
      if (!p.hinge) continue
      for (const pt of [p.hinge.from, p.hinge.to])
        for (let a = 0; a < 3; a++) {
          expect(pt[a]).toBeGreaterThanOrEqual(lo(p)[a] - 1e-2)
          expect(pt[a]).toBeLessThanOrEqual(hi(p)[a] + 1e-2)
        }
    }
    const lids = r.parts.filter((p) => p.type === "lid")
    const hinged = lids.filter((p) => p.hinge).length
    expect(hinged).toBe(lidType === "split" ? 2 : 1)
  })
})
