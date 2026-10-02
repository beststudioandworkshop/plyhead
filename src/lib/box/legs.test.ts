import { describe, it, expect } from "vitest"
import { buildBox } from "./index"
import { rotateVec } from "./rotation"
import type { BoxInputs, IssueCode, LegInputs, LidPosition, Part, Vec3 } from "./types"
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

const W = inToMm(18)
const D = inToMm(12)
const H = inToMm(10)
const T = 18
const TOL = 1e-4
const EPS = 1e-3

const legs = (over: Partial<LegInputs> = {}): LegInputs => ({
  style: "none",
  height: 100,
  diameter: 38,
  inset: 12,
  width: 76,
  footWidth: 38,
  ...over,
})
const dowel = (over: Partial<LegInputs> = {}) => legs({ style: "dowel", ...over })
const tapered = (over: Partial<LegInputs> = {}) => legs({ style: "tapered", ...over })

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const overlaps = (a: Part, b: Part) =>
  [0, 1, 2].every((i) => Math.min(hi(a)[i], hi(b)[i]) - Math.max(lo(a)[i], lo(b)[i]) > TOL)
const legsOf = (parts: Part[]) => parts.filter((p) => p.type === "leg")
const LIDS: LidPosition[] = ["top", "front"]

describe("leg validation", () => {
  const codes = (l: LegInputs) => buildBox(inputs({ legs: l })).issues.map((i) => i.code)
  const expectBad = (l: LegInputs, code: IssueCode) => {
    const r = buildBox(inputs({ legs: l }))
    expect(r.ok, JSON.stringify(l)).toBe(false)
    expect(r.issues.map((i) => i.code), JSON.stringify(l)).toEqual([code])
    expect(r.parts).toEqual([])
    expect(r.exterior).toEqual({ w: W, d: D, h: H })
  }

  it("style none has no issues and no legs, whatever the numbers", () => {
    for (const over of [{}, { height: -1, diameter: -1, inset: -5, width: 0, footWidth: 0 }]) {
      const r = buildBox(inputs({ legs: legs(over) }))
      expect(r.ok).toBe(true)
      expect(r.issues).toEqual([])
      expect(legsOf(r.parts)).toHaveLength(0)
    }
  })

  describe("dowel", () => {
    it.each([
      ["zero height", { height: 0 }],
      ["negative height", { height: -1 }],
      ["NaN height", { height: NaN }],
      ["zero diameter", { diameter: 0 }],
      ["negative diameter", { diameter: -5 }],
      ["NaN diameter", { diameter: NaN }],
      ["negative inset", { inset: -1 }],
      ["NaN inset", { inset: NaN }],
    ])("%s -> legs-invalid-size", (_n, over) => {
      expectBad(dowel(over), "legs-invalid-size")
    })

    it("zero inset is valid", () => {
      expect(buildBox(inputs({ legs: dowel({ inset: 0 }) })).ok).toBe(true)
    })

    it("inset + diameter > min(w,d)/2 -> legs-too-large-for-face", () => {
      expectBad(dowel({ diameter: 145, inset: 12 }), "legs-too-large-for-face")
      expectBad(dowel({ diameter: 140.5, inset: 12 }), "legs-too-large-for-face")
      expectBad(dowel({ diameter: 38, inset: 120 }), "legs-too-large-for-face")
    })

    it("exactly half is allowed", () => {
      const r = buildBox(inputs({ legs: dowel({ diameter: D / 2 - 12, inset: 12 }) }))
      expect(r.ok).toBe(true)
      expect(legsOf(r.parts)).toHaveLength(4)
    })

    it("ignores tapered-only fields", () => {
      expect(buildBox(inputs({ legs: dowel({ width: -1, footWidth: -1 }) })).ok).toBe(true)
    })
  })

  describe("tapered", () => {
    it.each([
      ["zero height", { height: 0 }],
      ["negative height", { height: -3 }],
      ["zero width", { width: 0 }],
      ["negative width", { width: -10 }],
      ["zero foot width", { footWidth: 0 }],
      ["negative foot width", { footWidth: -2 }],
      ["NaN width", { width: NaN }],
      ["NaN foot width", { footWidth: NaN }],
      ["foot wider than top", { width: 50, footWidth: 60 }],
    ])("%s -> legs-invalid-size", (_n, over) => {
      expectBad(tapered(over), "legs-invalid-size")
    })

    it("foot no wider than the plywood thickness -> legs-foot-too-narrow", () => {
      expectBad(tapered({ footWidth: 10 }), "legs-foot-too-narrow")
      expectBad(tapered({ footWidth: T }), "legs-foot-too-narrow")
      expect(codes(tapered({ footWidth: T + 0.1 }))).toEqual([])
    })

    it("top width > min(w,d)/2 -> legs-too-large-for-face", () => {
      expectBad(tapered({ width: 160, footWidth: 38 }), "legs-too-large-for-face")
      expectBad(tapered({ width: D / 2 + 0.5, footWidth: 38 }), "legs-too-large-for-face")
    })

    it("exactly half is allowed", () => {
      expect(codes(tapered({ width: D / 2 }))).toEqual([])
    })

    it("foot equal to top (straight legs) is allowed", () => {
      expect(codes(tapered({ width: 60, footWidth: 60 }))).toEqual([])
    })

    it("the foot limit follows the plywood thickness", () => {
      const r = buildBox(inputs({ thickness: 12, legs: tapered({ footWidth: 14 }) }))
      expect(r.ok).toBe(true)
      const bad = buildBox(inputs({ thickness: 30, legs: tapered({ footWidth: 28 }) }))
      expect(bad.issues.map((i) => i.code)).toEqual(["legs-foot-too-narrow"])
    })

    it("ignores dowel-only fields", () => {
      expect(buildBox(inputs({ legs: tapered({ diameter: -1, inset: -1 }) })).ok).toBe(true)
    })
  })

  it("a box that is too small reports its own issue before leg issues", () => {
    const r = buildBox(inputs({ dims: { w: 30, d: 200, h: 200 }, legs: dowel({ height: -1 }) }))
    expect(r.issues.map((i) => i.code)).toEqual(["interior-too-small"])
  })
})

describe.each(LIDS)("dowel legs, %s lid", (lidPosition) => {
  const height = 100
  const d = 38
  const inset = 12
  const r = buildBox(inputs({ lidPosition, legs: dowel({ height, diameter: d, inset }) }))
  const lg = legsOf(r.parts)

  it("builds four cylinder parts named Dowel leg", () => {
    expect(r.ok).toBe(true)
    expect(lg).toHaveLength(4)
    for (const p of lg) {
      expect(p.name).toBe("Dowel leg")
      expect(p.type).toBe("leg")
      expect(p.shape).toBe("cylinder")
      expect(p.outline).toBeUndefined()
      expect(p.length).toBeCloseTo(height, 6)
      expect(p.width).toBeCloseTo(d, 6)
      expect(p.thickness).toBeCloseTo(d, 6)
      expect(p.grain).toBeNull()
      expect(p.extents[0]).toBeCloseTo(d, 6)
      expect(p.extents[1]).toBeCloseTo(height, 6)
      expect(p.extents[2]).toBeCloseTo(d, 6)
    }
  })

  it("projects below the bottom: y from -height to 0", () => {
    for (const p of lg) {
      expect(lo(p)[1]).toBeCloseTo(-height, 6)
      expect(hi(p)[1]).toBeCloseTo(0, 6)
    }
  })

  it("centres are inset + d/2 from each corner, in order back-left, back-right, front-left, front-right", () => {
    const c = inset + d / 2
    const expected: [number, number][] = [
      [c, c],
      [W - c, c],
      [c, D - c],
      [W - c, D - c],
    ]
    lg.forEach((p, i) => {
      expect(p.center[0]).toBeCloseTo(expected[i][0], 6)
      expect(p.center[2]).toBeCloseTo(expected[i][1], 6)
      expect(p.center[1]).toBeCloseTo(-height / 2, 6)
    })
  })

  it("is symmetric about the footprint centre and inside it", () => {
    const sum = lg.reduce((s, p) => [s[0] + p.center[0], s[1] + p.center[2]], [0, 0])
    expect(sum[0] / 4).toBeCloseTo(W / 2, 6)
    expect(sum[1] / 4).toBeCloseTo(D / 2, 6)
    for (const p of lg) {
      expect(lo(p)[0]).toBeGreaterThanOrEqual(inset - EPS)
      expect(hi(p)[0]).toBeLessThanOrEqual(W - inset + EPS)
      expect(lo(p)[2]).toBeGreaterThanOrEqual(inset - EPS)
      expect(hi(p)[2]).toBeLessThanOrEqual(D - inset + EPS)
    }
  })

  it("extents agree with the rotated (length, thickness, width) vector", () => {
    for (const p of lg) {
      const rv = rotateVec(p.rotation, [p.length, p.thickness, p.width])
      for (let a = 0; a < 3; a++) expect(Math.abs(rv[a])).toBeCloseTo(p.extents[a], 2)
    }
  })

  it("ids are unique and bounds include the legs", () => {
    const ids = r.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.bounds.min[1]).toBeCloseTo(-height, 6)
    expect(r.bounds.min[0]).toBeCloseTo(0, 6)
    expect(r.bounds.min[2]).toBeCloseTo(0, 6)
    expect(r.bounds.max[0]).toBeCloseTo(W, 2)
    expect(r.bounds.max[1]).toBeCloseTo(H, 2)
    expect(r.bounds.max[2]).toBeCloseTo(D, 2)
  })

  it("legs overlap nothing", () => {
    for (const p of lg)
      for (const q of r.parts) {
        if (p === q) continue
        expect(overlaps(p, q), `${p.id} vs ${q.id}`).toBe(false)
      }
  })
})

describe.each(LIDS)("tapered legs, %s lid", (lidPosition) => {
  const height = 100
  const Wt = 76
  const F = 38
  const r = buildBox(inputs({ lidPosition, legs: tapered({ height, width: Wt, footWidth: F }) }))
  const lg = legsOf(r.parts)
  const plateA = lg.filter((p) => p.name === "Leg plate A")
  const plateB = lg.filter((p) => p.name === "Leg plate B")

  it("builds 8 polygon parts: a plate A and a plate B per corner", () => {
    expect(r.ok).toBe(true)
    expect(lg).toHaveLength(8)
    expect(plateA).toHaveLength(4)
    expect(plateB).toHaveLength(4)
    for (const p of lg) {
      expect(p.type).toBe("leg")
      expect(p.shape).toBe("polygon")
      expect(p.thickness).toBeCloseTo(T, 6)
      expect(p.length).toBeCloseTo(height, 6)
      expect(p.outline).toHaveLength(4)
      expect(p.grain).toBeNull()
    }
    for (const p of plateA) {
      expect(p.width).toBeCloseTo(Wt, 6)
      expect(p.footWidth).toBeCloseTo(F, 6)
    }
    for (const p of plateB) {
      expect(p.width).toBeCloseTo(Wt - T, 6)
      expect(p.footWidth).toBeCloseTo(F - T, 6)
    }
  })

  it("extents agree with the rotated (length, thickness, width) vector", () => {
    for (const p of lg) {
      const rv = rotateVec(p.rotation, [p.length, p.thickness, p.width])
      for (let a = 0; a < 3; a++) expect(Math.abs(rv[a])).toBeCloseTo(p.extents[a], 2)
    }
  })

  it("plate A runs along x with its thickness along z; plate B runs along z with thickness along x", () => {
    for (const p of plateA) {
      expect(p.extents[0]).toBeCloseTo(Wt, 6)
      expect(p.extents[1]).toBeCloseTo(height, 6)
      expect(p.extents[2]).toBeCloseTo(T, 6)
    }
    for (const p of plateB) {
      expect(p.extents[0]).toBeCloseTo(T, 6)
      expect(p.extents[1]).toBeCloseTo(height, 6)
      expect(p.extents[2]).toBeCloseTo(Wt - T, 6)
    }
  })

  it("plates hug the exterior faces and span y from -height to 0", () => {
    // corner order: back-left, back-right, front-left, front-right
    const corners = [
      { left: true, back: true },
      { left: false, back: true },
      { left: true, back: false },
      { left: false, back: false },
    ]
    corners.forEach((c, i) => {
      const a = plateA[i]
      const b = plateB[i]
      for (const p of [a, b]) {
        expect(lo(p)[1]).toBeCloseTo(-height, 6)
        expect(hi(p)[1]).toBeCloseTo(0, 6)
      }
      // A: flush with the front/back face, outer end flush with the side
      if (c.back) expect(lo(a)[2]).toBeCloseTo(0, 6)
      else expect(hi(a)[2]).toBeCloseTo(D, 6)
      if (c.left) expect(lo(a)[0]).toBeCloseTo(0, 6)
      else expect(hi(a)[0]).toBeCloseTo(W, 6)
      // B: flush with the side face, starts where A ends
      if (c.left) expect(lo(b)[0]).toBeCloseTo(0, 6)
      else expect(hi(b)[0]).toBeCloseTo(W, 6)
      if (c.back) {
        expect(lo(b)[2]).toBeCloseTo(T, 6)
        expect(hi(b)[2]).toBeCloseTo(Wt, 6)
        expect(hi(a)[2]).toBeCloseTo(T, 6)
      } else {
        expect(hi(b)[2]).toBeCloseTo(D - T, 6)
        expect(lo(b)[2]).toBeCloseTo(D - Wt, 6)
        expect(lo(a)[2]).toBeCloseTo(D - T, 6)
      }
    })
  })

  it("plates A and B at a corner touch but do not overlap", () => {
    for (let i = 0; i < 4; i++) {
      expect(overlaps(plateA[i], plateB[i])).toBe(false)
      // they do share a face: z ranges meet at the inner face of A
      const aZ = plateA[i].center[2] < D / 2 ? hi(plateA[i])[2] : lo(plateA[i])[2]
      const bZ = plateB[i].center[2] < D / 2 ? lo(plateB[i])[2] : hi(plateB[i])[2]
      expect(aZ).toBeCloseTo(bZ, 6)
    }
  })

  it("outlines are trapezoids: two points at the top width, two at the foot width", () => {
    for (const p of lg) {
      const pts = p.outline!
      // world y of each point
      const world = pts.map(([ox, oy]) => {
        const v = rotateVec(p.rotation, [ox, 0, oy])
        return [v[0] + p.center[0], v[1] + p.center[1], v[2] + p.center[2]] as Vec3
      })
      const topPts = world.filter((v) => Math.abs(v[1]) < EPS)
      const footPts = world.filter((v) => Math.abs(v[1] + height) < EPS)
      expect(topPts).toHaveLength(2)
      expect(footPts).toHaveLength(2)

      const topW = Math.hypot(topPts[0][0] - topPts[1][0], topPts[0][2] - topPts[1][2])
      const footW = Math.hypot(footPts[0][0] - footPts[1][0], footPts[0][2] - footPts[1][2])
      expect(topW).toBeCloseTo(p.width, 2)
      expect(footW).toBeCloseTo(p.footWidth!, 2)

      // in local coords too: spread across the width axis (y) at each end of the length (x)
      const localTop = pts.filter(([ox]) => Math.abs(Math.abs(ox) - height / 2) < EPS)
      expect(localTop).toHaveLength(4)

      // area of the trapezoid
      let area = 0
      for (let k = 0; k < 4; k++) {
        const [x1, y1] = pts[k]
        const [x2, y2] = pts[(k + 1) % 4]
        area += x1 * y2 - x2 * y1
      }
      expect(Math.abs(area) / 2).toBeCloseTo((height * (p.width + p.footWidth!)) / 2, 1)
    }
  })

  it("outline points lie on the plate's mid-plane", () => {
    for (const p of lg) {
      const thicknessAxis = p.name === "Leg plate A" ? 2 : 0
      for (const [ox, oy] of p.outline!) {
        const v = rotateVec(p.rotation, [ox, 0, oy])
        const world = v[thicknessAxis] + p.center[thicknessAxis]
        expect(world).toBeCloseTo(p.center[thicknessAxis], 6)
        const y = v[1] + p.center[1]
        expect(Math.min(Math.abs(y), Math.abs(y + height))).toBeLessThan(EPS)
      }
    }
  })

  it("the vertical outer edge of each plate is flush with the box's outer face", () => {
    const worldPts = (p: Part) =>
      p.outline!.map(([ox, oy]) => {
        const v = rotateVec(p.rotation, [ox, 0, oy])
        return [v[0] + p.center[0], v[1] + p.center[1], v[2] + p.center[2]] as Vec3
      })
    plateA.forEach((p) => {
      const pts = worldPts(p)
      // plate A's outer corner edge sits at x = 0 or x = W (the side face), at both y levels
      const atSide = pts.filter((v) => Math.abs(v[0]) < EPS || Math.abs(v[0] - W) < EPS)
      expect(atSide).toHaveLength(2)
      expect(new Set(atSide.map((v) => Math.round(v[1] * 1000))).size).toBe(2)
      expect(atSide[0][0]).toBeCloseTo(atSide[1][0], 6)
      // and it is the mid-plane z of a plate flush with the front/back face
      expect([T / 2, D - T / 2].some((z) => Math.abs(pts[0][2] - z) < EPS)).toBe(true)
    })
    plateB.forEach((p) => {
      const pts = worldPts(p)
      // plate B's mid-plane is t/2 inside the side face
      expect([T / 2, W - T / 2].some((x) => Math.abs(pts[0][0] - x) < EPS)).toBe(true)
      // its vertical edge at the inner end meets plate A's inner face (z = t or D - t)
      const inner = pts.filter((v) => Math.abs(v[2] - T) < EPS || Math.abs(v[2] - (D - T)) < EPS)
      expect(inner).toHaveLength(2)
      expect(new Set(inner.map((v) => Math.round(v[1] * 1000))).size).toBe(2)
    })
  })

  it("legs stay inside the box footprint in x and z", () => {
    for (const p of lg) {
      expect(lo(p)[0]).toBeGreaterThanOrEqual(-EPS)
      expect(lo(p)[2]).toBeGreaterThanOrEqual(-EPS)
      expect(hi(p)[0]).toBeLessThanOrEqual(W + EPS)
      expect(hi(p)[2]).toBeLessThanOrEqual(D + EPS)
    }
  })

  it("no leg overlaps another leg or any carcass/lid part", () => {
    for (const p of lg)
      for (const q of r.parts) {
        if (p === q) continue
        expect(overlaps(p, q), `${p.id} vs ${q.id}`).toBe(false)
      }
  })

  it("ids are unique and bounds include the legs", () => {
    const ids = r.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.bounds.min[1]).toBeCloseTo(-height, 6)
    expect(r.bounds.max[1]).toBeCloseTo(H, 2)
  })
})

describe("legs and the rest of the box", () => {
  it("legs do not change exterior or interior", () => {
    const a = buildBox(inputs())
    for (const l of [dowel(), tapered()]) {
      const b = buildBox(inputs({ legs: l }))
      expect(b.exterior).toEqual(a.exterior)
      expect(b.interior).toEqual(a.interior)
    }
  })

  it("style none adds no parts; legs add 4 or 8", () => {
    const n = buildBox(inputs()).parts.length
    expect(buildBox(inputs({ legs: dowel() })).parts.length).toBe(n + 4)
    expect(buildBox(inputs({ legs: tapered() })).parts.length).toBe(n + 8)
  })

  it("bounds min y follows the leg height", () => {
    for (const style of ["dowel", "tapered"] as const)
      for (const height of [30, 100, 250.5]) {
        const r = buildBox(inputs({ legs: legs({ style, height }) }))
        expect(r.bounds.min[1]).toBeCloseTo(-height, 2)
      }
  })

  it("works with other thicknesses: tapered plates are one plywood thick", () => {
    const r = buildBox(inputs({ thickness: 12, legs: tapered({ footWidth: 30 }) }))
    expect(r.ok).toBe(true)
    for (const p of legsOf(r.parts)) expect(p.thickness).toBeCloseTo(12, 6)
    const b = legsOf(r.parts).find((p) => p.name === "Leg plate B")!
    expect(b.width).toBeCloseTo(76 - 12, 6)
    expect(b.footWidth).toBeCloseTo(30 - 12, 6)
  })
})
