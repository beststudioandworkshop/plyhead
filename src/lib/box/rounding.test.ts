import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { groupParts } from "./cutlist"
import { SHEET_PRESETS } from "./constants"
import { nestParts } from "./nesting"
import { roundParts, roundingStep } from "./rounding"
import type { BoxInputs, LegInputs, Part } from "./types"
import { inToMm } from "./units"

const TOL = 1e-6
// Outline points are stored at 0.001 mm precision (PART_PRECISION_MM), so a
// half-length like 49.2125 is stored as 49.212: compare to ~1e-3, not 1e-6.
const OUT_DIGITS = 2
const NO_LEGS: LegInputs = { style: "none", height: 101.6, diameter: 38.1, inset: 12.7, width: 76.2, footWidth: 38.1 }

const inputs = (over: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: inToMm(0.71),
  lidPosition: "top",
  lidType: "full",
  openLeaf: "first",
  hingeSide: "long",
  bottomStyle: "inset",
  dividers: 0,
  legs: NO_LEGS,
  joinery: "butt",
  ...over,
})

const build = (over: Partial<BoxInputs> = {}, legs: Partial<LegInputs> = {}): Part[] => {
  const r = buildBox(inputs({ ...over, legs: { ...NO_LEGS, ...legs } }))
  expect(r.ok).toBe(true)
  return r.parts
}

const variants: [string, Part[]][] = [
  ["exterior top full", build()],
  ["interior top full", build({ dimensionMode: "interior" })],
  ["front lid", build({ lidPosition: "front" })],
  ["lap bottom, dividers", build({ bottomStyle: "lap", dividers: 2 })],
  ["dowel legs", build({}, { style: "dowel" })],
  ["tapered legs", build({}, { style: "tapered" })],
]

const isMultiple = (v: number, step: number) => {
  const k = Math.round(v / step)
  return Math.abs(v - k * step) < TOL
}

describe.each([
  ["in", roundingStep("in")],
  ["mm", roundingStep("mm")],
])("roundParts (%s)", (_u, step) => {
  describe.each(variants)("%s", (_n, parts) => {
    const out = roundParts(parts, step)

    it("snaps length/width to the step, within step/2 (or raised to one step)", () => {
      expect(out).toHaveLength(parts.length)
      out.forEach((p, i) => {
        const o = parts[i]
        const dims = o.shape === "cylinder" ? [["length", o.length], ["width", o.width]] as const : ([["length", o.length], ["width", o.width]] as const)
        for (const [k, orig] of dims) {
          const v = p[k]
          expect(isMultiple(v, step)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(step - TOL)
          if (orig >= step) expect(Math.abs(v - orig)).toBeLessThanOrEqual(step / 2 + TOL)
          else expect(v).toBeCloseTo(step, 6)
        }
      })
    })

    it("keeps thickness for boards and leaves identity fields alone", () => {
      out.forEach((p, i) => {
        const o = parts[i]
        if (o.shape !== "cylinder") expect(p.thickness).toBe(o.thickness)
        expect(p.id).toBe(o.id)
        expect(p.name).toBe(o.name)
        expect(p.type).toBe(o.type)
        expect(p.center).toEqual(o.center)
        expect(p.extents).toEqual(o.extents)
        expect(p.rotation).toEqual(o.rotation)
      })
    })

    it("does not mutate its input", () => {
      const copy = structuredClone(parts)
      roundParts(parts, step)
      expect(parts).toEqual(copy)
    })

    it("is idempotent", () => {
      expect(roundParts(out, step)).toEqual(out)
    })
  })
})

describe("roundingStep", () => {
  it("is 1/8 inch in inches and 1 in mm", () => {
    expect(roundingStep("in")).toBe(3.175)
    expect(roundingStep("mm")).toBe(1)
  })
})

describe("basic behaviour", () => {
  it("rounds mm-ish values to whole millimetres", () => {
    const parts = build()
    const out = roundParts(parts, 1)
    out.forEach((p, i) => {
      expect(Number.isInteger(p.length)).toBe(true)
      expect(Number.isInteger(p.width)).toBe(true)
      expect(Math.abs(p.length - parts[i].length)).toBeLessThanOrEqual(0.5 + TOL)
    })
  })

  it("raises tiny parts to exactly one step", () => {
    const base = build()[0]
    const tiny: Part = { ...base, length: 0.2, width: 0.4 }
    const [a] = roundParts([tiny], 3.175)
    expect(a.length).toBe(3.175)
    expect(a.width).toBe(3.175)
    const [b] = roundParts([tiny], 1)
    expect(b.length).toBe(1)
    expect(b.width).toBe(1)
  })

  it("leaves sizes alone with an absurdly small step", () => {
    for (const [, parts] of variants) {
      const out = roundParts(parts, 1e-4)
      out.forEach((p, i) => {
        expect(Math.abs(p.length - parts[i].length)).toBeLessThan(1e-3)
        expect(Math.abs(p.width - parts[i].width)).toBeLessThan(1e-3)
        if (p.footWidth !== undefined) expect(Math.abs(p.footWidth - parts[i].footWidth!)).toBeLessThan(1e-3)
      })
    }
  })
})

describe("dowels", () => {
  it.each([roundingStep("in"), roundingStep("mm")])("width === thickness === rounded diameter (step %s)", (step) => {
    const parts = build({}, { style: "dowel" })
    const dowels = parts.filter((p) => p.shape === "cylinder")
    expect(dowels).toHaveLength(4)
    const out = roundParts(parts, step)
    out.forEach((p, i) => {
      if (parts[i].shape !== "cylinder") return
      expect(p.width).toBe(p.thickness)
      expect(isMultiple(p.width, step)).toBe(true)
      expect(Math.abs(p.width - parts[i].width)).toBeLessThanOrEqual(step / 2 + TOL)
      expect(isMultiple(p.length, step)).toBe(true)
      expect(Math.abs(p.length - parts[i].length)).toBeLessThanOrEqual(step / 2 + TOL)
    })
  })
})

describe("tapered plates", () => {
  const cases: [string, Partial<LegInputs>][] = [
    ["default", {}],
    ["odd sizes", { width: 70.3, footWidth: 33.7, height: 97.4 }],
    ["foot near top width", { width: 60.1, footWidth: 59.9 }],
  ]
  describe.each([roundingStep("in"), roundingStep("mm")])("step %s", (step) => {
    it.each(cases)("%s: rounded trapezoid outline is consistent", (_n, over) => {
      const parts = build({}, { style: "tapered", ...over })
      const out = roundParts(parts, step)
      const plates = out.filter((p) => p.shape === "polygon")
      expect(plates.filter((p) => p.name === "Leg plate A")).toHaveLength(4)
      expect(plates.filter((p) => p.name === "Leg plate B")).toHaveLength(4)

      for (const p of plates) {
        const foot = p.footWidth!
        expect(foot).toBeLessThanOrEqual(p.width + TOL)
        expect(isMultiple(foot, step)).toBe(true)
        const o = p.outline!
        expect(o).toHaveLength(4)

        const us = o.map((q) => q[0])
        const vs = o.map((q) => q[1])
        const uMin = Math.min(...us)
        const uMax = Math.max(...us)
        const vMin = Math.min(...vs)
        const vMax = Math.max(...vs)
        expect(uMax - uMin).toBeCloseTo(p.length, OUT_DIGITS)
        expect(vMax - vMin).toBeCloseTo(p.width, OUT_DIGITS)
        // centred
        expect(uMin).toBeCloseTo(-p.length / 2, OUT_DIGITS)
        expect(uMax).toBeCloseTo(p.length / 2, OUT_DIGITS)

        const end = (u: number) => o.filter((q) => Math.abs(q[0] - u) < 1e-6)
        const lo = end(uMin)
        const hi = end(uMax)
        expect(lo).toHaveLength(2)
        expect(hi).toHaveLength(2)
        const span = (pts: [number, number][]) => Math.abs(pts[0][1] - pts[1][1])
        const spans = [span(lo), span(hi)].sort((a, b) => b - a)
        expect(spans[0]).toBeCloseTo(p.width, OUT_DIGITS)
        expect(spans[1]).toBeCloseTo(foot, OUT_DIGITS)

        // straight shared edge: both ends share the same extreme v
        const flushLow = [lo, hi].every((e) => e.some((q) => Math.abs(q[1] - vMin) < 1e-6))
        const flushHigh = [lo, hi].every((e) => e.some((q) => Math.abs(q[1] - vMax) < 1e-6))
        expect(flushLow || flushHigh).toBe(true)

        // trapezoid area
        let area = 0
        for (let i = 0; i < 4; i++) {
          const [x1, y1] = o[i]
          const [x2, y2] = o[(i + 1) % 4]
          area += x1 * y2 - x2 * y1
        }
        expect(Math.abs(area) / 2).toBeCloseTo((p.length * (p.width + foot)) / 2, 1)
      }
    })
  })
})

describe("downstream consistency", () => {
  const sheet = SHEET_PRESETS[0]

  it.each([
    ["in", roundingStep("in")],
    ["mm", roundingStep("mm")],
  ])("nestParts places rounded sizes (%s)", (_u, step) => {
    const parts = roundParts(build({ dividers: 1 }, { style: "tapered" }), step)
    const res = nestParts(parts, sheet, 3.175)
    expect(res.unplaced).toHaveLength(0)
    const byId = new Map(parts.map((p) => [p.id, p]))
    const placements = res.sheets.flatMap((s) => s.placements)
    expect(placements).toHaveLength(parts.length)
    for (const pl of placements) {
      const p = byId.get(pl.partId)!
      const [w, h] = pl.rotated ? [p.width, p.length] : [p.length, p.width]
      expect(pl.w).toBeCloseTo(w, 6)
      expect(pl.h).toBeCloseTo(h, 6)
    }
  })

  it("groupParts still groups the two sides and conserves quantity", () => {
    for (const step of [roundingStep("in"), roundingStep("mm")]) {
      for (const [, raw] of variants) {
        const parts = roundParts(raw, step)
        const rows = groupParts(parts)
        const side = rows.find((r) => r.name === "Side")!
        expect(side.quantity).toBe(2)
        expect(rows.reduce((n, r) => n + r.quantity, 0)).toBe(parts.length)
        expect(rows.length).toBeLessThanOrEqual(groupParts(raw).length)
      }
    }
  })
})
