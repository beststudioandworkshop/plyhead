import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { DEFAULT_KERF_MM, SHEET_PRESETS } from "./constants"
import { nestParts, nestableParts, type Cut, type FirstCut, type NestResult, type NestedSheet } from "./nesting"
import type { BoxInputs, Part } from "./types"
import { inToMm } from "./units"

const S48 = SHEET_PRESETS.find((s) => s.id === "4x8")!
const S55 = SHEET_PRESETS.find((s) => s.id === "5x5")!

let n = 0
const mk = (length: number, width: number, extra: Partial<Part> = {}): Part => ({
  id: extra.id ?? `p${++n}`,
  name: "Part",
  type: "side",
  length,
  width,
  thickness: 18,
  center: [0, 0, 0],
  rotation: [0, 0, 0],
  extents: [length, 18, width],
  shape: "box",
  grain: null,
  ...extra,
})

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const boxInputs = (style: "none" | "dowel" | "tapered"): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  hingeSide: "long",
  openLeaf: "second",
  legs: { style, height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  joinery: "butt",
  bottomStyle: "inset",
  dividers: 0,
})

function checkInvariants(r: NestResult, input: Part[]) {
  const { sheet, kerf } = r
  for (const s of r.sheets) {
    for (const p of s.placements) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6)
      expect(p.y).toBeGreaterThanOrEqual(-1e-6)
      expect(p.x + p.w).toBeLessThanOrEqual(sheet.w + 1e-6)
      expect(p.y + p.h).toBeLessThanOrEqual(sheet.h + 1e-6)
    }
    for (let i = 0; i < s.placements.length; i++) {
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i]
        const b = s.placements[j]
        const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
        const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(kerf - 1e-6)
      }
    }
    expect(s.usedArea).toBeCloseTo(s.placements.reduce((n, p) => n + p.w * p.h, 0), 6)
  }
  const ids = [
    ...r.sheets.flatMap((s) => s.placements.map((p) => p.partId)),
    ...r.unplaced.map((p) => p.id),
    ...r.excluded.map((p) => p.id),
  ].sort()
  expect(ids).toEqual(input.map((p) => p.id).sort())
  const area = r.sheets.reduce((n, s) => n + s.usedArea, 0)
  expect(r.partArea).toBeCloseTo(area, 6)
  expect(r.yield).toBeCloseTo(
    r.sheets.length ? area / (r.sheets.length * sheet.w * sheet.h) : 0,
    9,
  )
}

describe("nestableParts", () => {
  it("separates cylinders", () => {
    const a = mk(100, 50)
    const d = mk(100, 38, { shape: "cylinder", type: "leg" })
    const r = nestableParts([a, d])
    expect(r.sheetParts).toEqual([a])
    expect(r.excluded).toEqual([d])
  })
})

describe("nestParts", () => {
  it("handles an empty input", () => {
    const r = nestParts([], S48, 3)
    expect(r.sheets).toEqual([])
    expect(r.yield).toBe(0)
    expect(r.partArea).toBe(0)
  })

  it("places a single part at the origin", () => {
    const p = mk(500, 300)
    const r = nestParts([p], S48, 3)
    expect(r.sheets).toHaveLength(1)
    expect(r.sheets[0].placements[0]).toMatchObject({ x: 0, y: 0, w: 500, h: 300, rotated: false })
    expect(r.yield).toBeCloseTo((500 * 300) / (S48.w * S48.h), 9)
  })

  it("fits a part exactly the sheet size", () => {
    const p = mk(S48.h, S48.w)
    const r = nestParts([p], S48, 6)
    expect(r.unplaced).toHaveLength(0)
    expect(r.sheets).toHaveLength(1)
    expect(r.yield).toBeCloseTo(1, 9)
  })

  it("sends oversize parts to unplaced", () => {
    const big = mk(1700, 100)
    const r = nestParts([big], S55, 3)
    expect(r.sheets).toHaveLength(0)
    expect(r.unplaced).toEqual([big])
    expect(r.yield).toBe(0)
    const huge = mk(3000, 3000)
    expect(nestParts([huge], S48, 3).unplaced).toHaveLength(1)
  })

  it("fits a 2300 x 200 part on 4x8 (sheet is 1219 wide, so only rotated)", () => {
    const r = nestParts([mk(2300, 200)], S48, 3)
    expect(r.unplaced).toHaveLength(0)
    expect(r.sheets[0].placements[0]).toMatchObject({ rotated: true, w: 200, h: 2300 })
    // a pre-oriented 200 x 2300 part is unrotated
    const r2 = nestParts([mk(200, 2300)], S48, 3)
    expect(r2.sheets[0].placements[0].rotated).toBe(false)
  })

  it("rotates a part that is only tall enough rotated", () => {
    // Sheet is 1219.2 wide x 2438.4 tall: 2000 long only fits along y.
    const r = nestParts([mk(2000, 300)], S48, 3)
    expect(r.unplaced).toHaveLength(0)
    expect(r.sheets[0].placements[0]).toMatchObject({ rotated: true, w: 300, h: 2000 })
  })

  it("forbids rotation when grain is set", () => {
    const p = mk(2000, 300, { grain: "length" })
    const r = nestParts([p], S48, 3)
    expect(r.unplaced).toEqual([p])
    const ok = mk(1000, 300, { grain: "length" })
    const r2 = nestParts([ok, mk(1000, 300, { grain: "width" })], S48, 3)
    expect(r2.sheets.flatMap((s) => s.placements).every((q) => !q.rotated)).toBe(true)
  })

  it("opens a second sheet when needed", () => {
    const parts = [mk(1200, 2400), mk(1200, 2400)]
    const r = nestParts(parts, S48, 3)
    expect(r.sheets).toHaveLength(2)
    expect(r.yield).toBeCloseTo((2 * 1200 * 2400) / (2 * S48.w * S48.h), 9)
    checkInvariants(r, parts)
  })

  it("separates adjacent parts by the kerf", () => {
    const parts = [mk(600, 600), mk(600, 600)]
    const r = nestParts(parts, S48, 6)
    const [a, b] = r.sheets[0].placements
    expect(Math.max(b.x - (a.x + a.w), b.y - (a.y + a.h), a.x - (b.x + b.w), a.y - (b.y + b.h))).toBeCloseTo(6, 6)
  })

  it("kerf 0 never packs worse than kerf 6", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rand = rng(seed)
      const parts = Array.from({ length: 40 }, () => mk(100 + rand() * 700, 80 + rand() * 500))
      const a = nestParts(parts, S55, 0)
      const b = nestParts(parts, S55, 6)
      expect(a.sheets.length).toBeLessThanOrEqual(b.sheets.length)
      checkInvariants(a, parts)
      checkInvariants(b, parts)
    }
  })

  it("holds invariants on seeded random sets, including oversize and cylinders", () => {
    for (const seed of [11, 22, 33, 44, 55, 66]) {
      const rand = rng(seed)
      const parts = Array.from({ length: 60 }, (_, i) => {
        const l = 20 + rand() * (i % 17 === 0 ? 2000 : 900)
        const w = 20 + rand() * 400
        return mk(l, w, {
          grain: rand() < 0.3 ? "length" : null,
          shape: rand() < 0.1 ? "cylinder" : "box",
        })
      })
      for (const sheet of SHEET_PRESETS) {
        for (const kerf of [0, DEFAULT_KERF_MM, 6]) {
          checkInvariants(nestParts(parts, sheet, kerf), parts)
        }
      }
    }
  })

  it("nests a real box with tapered legs", () => {
    const res = buildBox(boxInputs("tapered"))
    expect(res.ok).toBe(true)
    const r = nestParts(res.parts, S48, DEFAULT_KERF_MM)
    expect(r.unplaced).toHaveLength(0)
    expect(r.excluded).toHaveLength(0)
    expect(r.sheets).toHaveLength(1)
    checkInvariants(r, res.parts)
  })

  it("excludes dowels from a real box", () => {
    const res = buildBox(boxInputs("dowel"))
    const r = nestParts(res.parts, S55, DEFAULT_KERF_MM)
    expect(r.excluded).toHaveLength(4)
    expect(r.excluded.every((p) => p.shape === "cylinder")).toBe(true)
    checkInvariants(r, res.parts)
  })

  it("is deterministic", () => {
    const rand = rng(99)
    const parts = Array.from({ length: 30 }, () => mk(50 + rand() * 600, 50 + rand() * 300))
    expect(nestParts(parts, S55, 3)).toEqual(nestParts(parts, S55, 3))
    expect(nestParts([...parts].reverse(), S55, 3)).toEqual(nestParts(parts, S55, 3))
  })
})

// ---------------------------------------------------------------------------
// Cut plans
// ---------------------------------------------------------------------------

const TOL = 1e-5
const FIRST_CUTS: FirstCut[] = ["auto", "rip", "cross"]
const near = (a: number, b: number) => Math.abs(a - b) <= TOL

interface Panel {
  x: number
  y: number
  w: number
  h: number
  parentAxis: "rip" | "cross"
}

/** Replays every sheet's cuts; returns how many same-axis (continued) cuts occurred without a spanning piece. */
function replayCuts(r: NestResult, forced: "rip" | "cross" | null) {
  const { sheet, kerf } = r
  const longIsY = sheet.h >= sheet.w
  let count = 0
  let length = 0
  let unjustified = 0
  let firstCutMismatch = 0
  for (const s of r.sheets) {
    let panels: Panel[] = [
      { x: 0, y: 0, w: sheet.w, h: sheet.h, parentAxis: forced === "rip" ? "cross" : "rip" },
    ]
    s.cuts.forEach((c, ci) => {
      expect(c.index).toBe(ci + 1)
      const vertical = c.orientation === "vertical"
      expect(c.axis).toBe(vertical === longIsY ? "rip" : "cross")
      const pi = panels.findIndex(
        (p) => near(p.x, c.panel.x) && near(p.y, c.panel.y) && near(p.w, c.panel.w) && near(p.h, c.panel.h),
      )
      expect(pi).toBeGreaterThanOrEqual(0)
      const p = panels[pi]
      const extent = vertical ? p.w : p.h
      expect(c.length).toBeCloseTo(vertical ? p.h : p.w, 6)
      expect(c.offset).toBeGreaterThan(0)
      expect(c.offset).toBeLessThan(extent)
      expect(c.position).toBeCloseTo((vertical ? p.x : p.y) + c.offset, 6)
      const parts: Panel[] = []
      const a: Panel = vertical
        ? { x: p.x, y: p.y, w: c.offset, h: p.h, parentAxis: c.axis }
        : { x: p.x, y: p.y, w: p.w, h: c.offset, parentAxis: c.axis }
      parts.push(a)
      const rest = extent - c.offset - kerf
      if (rest > 1e-6) {
        parts.push(
          vertical
            ? { x: p.x + c.offset + kerf, y: p.y, w: rest, h: p.h, parentAxis: c.axis }
            : { x: p.x, y: p.y + c.offset + kerf, w: p.w, h: rest, parentAxis: c.axis },
        )
      }
      // The line and its kerf band never cross a placement that sits inside this panel.
      for (const q of s.placements) {
        const inside =
          q.x >= p.x - TOL && q.y >= p.y - TOL && q.x + q.w <= p.x + p.w + TOL && q.y + q.h <= p.y + p.h + TOL
        if (!inside) continue
        const lo = vertical ? q.x : q.y
        const hi = lo + (vertical ? q.w : q.h)
        expect(lo >= c.position + kerf - TOL || hi <= c.position + TOL).toBe(true)
      }
      if (forced && c.axis === p.parentAxis) {
        // continued cut: only allowed when a piece spans the panel across the skipped cut
        const spans = s.placements.some(
          (q) =>
            q.x >= a.x - TOL &&
            q.y >= a.y - TOL &&
            q.x + q.w <= a.x + a.w + TOL &&
            q.y + q.h <= a.y + a.h + TOL &&
            (vertical ? near(q.h, p.h) : near(q.w, p.w)),
        )
        if (!spans) unjustified++
        if (ci === 0) firstCutMismatch++
      }
      panels = [...panels.slice(0, pi), ...parts, ...panels.slice(pi + 1)]
      count++
      length += c.length
    })
    for (const q of s.placements) {
      const hosts = panels.filter(
        (p) =>
          q.x >= p.x - TOL && q.y >= p.y - TOL && q.x + q.w <= p.x + p.w + TOL && q.y + q.h <= p.y + p.h + TOL,
      )
      expect(hosts).toHaveLength(1)
    }
  }
  expect(r.cutCount).toBe(count)
  expect(r.cutLength).toBeCloseTo(length, 6)
  return { unjustified, firstCutMismatch }
}

const cutsOf = (s: NestedSheet): Cut[] => s.cuts

function randomParts(seed: number, count = 40): Part[] {
  const rand = rng(seed)
  return Array.from({ length: count }, (_, i) =>
    mk(30 + rand() * (i % 11 === 0 ? 1500 : 700), 30 + rand() * 450, {
      grain: rand() < 0.25 ? "length" : null,
      shape: rand() < 0.05 ? "cylinder" : "box",
    }),
  )
}

describe("cut plans", () => {
  it("replays to valid guillotine plans on random sets", () => {
    for (const seed of [3, 8, 13, 21, 34]) {
      const parts = randomParts(seed)
      for (const sheet of SHEET_PRESETS) {
        for (const kerf of [0, DEFAULT_KERF_MM, 6]) {
          for (const fc of FIRST_CUTS) {
            const r = nestParts(parts, sheet, kerf, { firstCut: fc })
            checkInvariants(r, parts)
            const forced = fc === "auto" ? null : fc
            const { unjustified } = replayCuts(r, r.strategy === "free" ? null : forced ?? r.strategy)
            expect(unjustified).toBe(0)
          }
        }
      }
    }
  })

  it("replays to valid plans on real boxes, including tapered legs", () => {
    for (const style of ["none", "dowel", "tapered"] as const) {
      for (const dividers of [0, 2]) {
        const res = buildBox({ ...boxInputs(style), dividers })
        expect(res.ok).toBe(true)
        for (const sheet of SHEET_PRESETS) {
          for (const kerf of [0, DEFAULT_KERF_MM, 6]) {
            for (const fc of FIRST_CUTS) {
              const r = nestParts(res.parts, sheet, kerf, { firstCut: fc })
              checkInvariants(r, res.parts)
              const { unjustified } = replayCuts(r, r.strategy === "free" ? null : (fc === "auto" ? r.strategy : fc))
              expect(unjustified).toBe(0)
            }
          }
        }
      }
    }
  })

  it("forced rip / cross start every sheet with that axis and alternate down the tree", () => {
    const res = buildBox(boxInputs("tapered"))
    for (const fc of ["rip", "cross"] as const) {
      const r = nestParts(res.parts, S48, DEFAULT_KERF_MM, { firstCut: fc })
      expect(r.strategy).toBe(fc)
      const { unjustified, firstCutMismatch } = replayCuts(r, fc)
      // No box part spans the sheet, so there are no continued (same-axis) cuts at all.
      expect(unjustified).toBe(0)
      expect(firstCutMismatch).toBe(0)
      for (const s of r.sheets) if (s.cuts.length) expect(s.cuts[0].axis).toBe(fc)
    }
    for (const seed of [4, 5, 6]) {
      const parts = randomParts(seed, 50).filter((p) => p.shape === "box")
      for (const fc of ["rip", "cross"] as const) {
        const r = nestParts(parts, S55, 3, { firstCut: fc })
        for (const s of r.sheets) {
          if (!s.cuts.length) continue
          const first = s.cuts[0]
          if (first.axis !== fc) {
            // documented exception: the first piece spans the sheet across the forced cut
            expect(s.placements.some((q) => near(q.w, S55.w) || near(q.h, S55.h))).toBe(true)
          }
        }
      }
    }
  })

  it("auto is never worse than a forced strategy and names its winner", () => {
    const key = (r: NestResult) => [r.sheets.length, r.cutCount, r.cutLength, -r.yield]
    const worse = (a: number[], b: number[]) => {
      for (let i = 0; i < 4; i++) {
        if (Math.abs(a[i] - b[i]) > 1e-6) return a[i] > b[i]
      }
      return false
    }
    const sets: Part[][] = [1, 2, 3, 4].map((s) => randomParts(s * 7))
    sets.push(buildBox(boxInputs("tapered")).parts)
    for (const parts of sets) {
      for (const sheet of SHEET_PRESETS) {
        const auto = nestParts(parts, sheet, 3)
        expect(["rip", "cross", "free"]).toContain(auto.strategy)
        for (const fc of ["rip", "cross"] as const) {
          const f = nestParts(parts, sheet, 3, { firstCut: fc })
          expect(f.strategy).toBe(fc)
          expect(worse(key(auto), key(f))).toBe(false)
        }
      }
    }
    expect(nestParts(sets[0], S55, 3, { firstCut: "auto" })).toEqual(nestParts(sets[0], S55, 3))
  })

  it("never uses more sheets than a plain free-rectangle pack", () => {
    const res = buildBox(boxInputs("tapered"))
    expect(nestParts(res.parts, S48, DEFAULT_KERF_MM).sheets).toHaveLength(1)
    expect(nestParts(res.parts, S55, DEFAULT_KERF_MM).sheets).toHaveLength(1)
  })

  it("maps rip / cross onto cut directions by the sheet's long edge", () => {
    // 4x8: long edge is y, so vertical cuts (constant x) are rip cuts.
    const a = nestParts([mk(500, 300, { grain: "length" })], S48, 3, { firstCut: "rip" })
    expect(a.sheets[0].cuts[0]).toMatchObject({ axis: "rip", orientation: "vertical" })
    const b = nestParts([mk(500, 300, { grain: "length" })], S48, 3, { firstCut: "cross" })
    expect(b.sheets[0].cuts[0]).toMatchObject({ axis: "cross", orientation: "horizontal" })
    // 5x5 ties: long edge is y as well.
    const c = nestParts([mk(500, 300, { grain: "length" })], S55, 3, { firstCut: "rip" })
    expect(c.sheets[0].cuts[0]).toMatchObject({ axis: "rip", orientation: "vertical" })
    const d = nestParts([mk(500, 300, { grain: "length" })], S55, 3, { firstCut: "cross" })
    expect(d.sheets[0].cuts[0]).toMatchObject({ axis: "cross", orientation: "horizontal" })
  })

  it("cut offsets, positions and lengths for a single part", () => {
    const r = nestParts([mk(500, 300, { grain: "length" })], S48, 3, { firstCut: "rip" })
    const [c1, c2] = cutsOf(r.sheets[0])
    expect(c1).toMatchObject({ index: 1, offset: 500, position: 500, length: S48.h })
    expect(c1.panel).toEqual({ x: 0, y: 0, w: S48.w, h: S48.h })
    expect(c2).toMatchObject({ index: 2, axis: "cross", orientation: "horizontal", offset: 300, position: 300, length: 500 })
    expect(c2.panel).toEqual({ x: 0, y: 0, w: 500, h: S48.h })
    expect(r.cutCount).toBe(2)
    expect(r.cutLength).toBeCloseTo(S48.h + 500, 6)
  })

  it("needs zero cuts for a part the size of the sheet and one trim cut for one free dimension", () => {
    const full = nestParts([mk(S48.h, S48.w)], S48, 6)
    expect(full.cutCount).toBe(0)
    expect(full.cutLength).toBe(0)
    expect(full.sheets[0].cuts).toEqual([])
    for (const fc of FIRST_CUTS) {
      const strip = nestParts([mk(S48.w, 500, { grain: "length" })], S48, 3, { firstCut: fc })
      expect(strip.cutCount).toBe(1)
      expect(strip.sheets[0].cuts[0]).toMatchObject({ axis: "cross", offset: 500, length: S48.w })
      const tall = nestParts([mk(500, S48.h, { grain: "length" })], S48, 3, { firstCut: fc })
      expect(tall.cutCount).toBe(1)
      expect(tall.sheets[0].cuts[0]).toMatchObject({ axis: "rip", offset: 500, length: S48.h })
    }
    // a leftover thinner than the kerf still costs a trim cut but leaves no free panel
    const thin = nestParts([mk(S55.w - 2, S55.h, { grain: "length" }), mk(1, S55.h, { grain: "length" })], S55, 3)
    expect(thin.sheets).toHaveLength(2)
    expect(thin.sheets[0].cuts).toHaveLength(1)
  })

  it("counts cuts for two parts side by side", () => {
    // Two 700 x 1524 strips on a 1524 square, kerf 3: rip at 700, then rip at 700 of the rest.
    const parts = [mk(700, S55.h, { grain: "length" }), mk(700, S55.h, { grain: "length" })]
    const r = nestParts(parts, S55, 3)
    expect(r.sheets).toHaveLength(1)
    expect(r.cutCount).toBe(2)
    expect(r.cutLength).toBeCloseTo(2 * S55.h, 6)
    expect(r.sheets[0].cuts.map((c) => c.axis)).toEqual(["rip", "rip"])
    expect(r.sheets[0].cuts[1].panel.x).toBeCloseTo(703, 6)
    expect(r.sheets[0].cuts[1].position).toBeCloseTo(1403, 6)
    // Two 700 x 500 parts stacked in one strip: rip, cross, then the strip rest is cut cross.
    const a = [mk(700, 500, { grain: "length" }), mk(700, 500, { grain: "length" })]
    const rr = nestParts(a, S55, 3, { firstCut: "rip" })
    expect(rr.sheets).toHaveLength(1)
    expect(rr.cutCount).toBe(3)
    // the second cross cut continues the strip: the piece spans the strip width, so no rip cut is needed
    expect(rr.sheets[0].cuts.map((c) => c.axis)).toEqual(["rip", "cross", "cross"])
    expect(rr.cutLength).toBeCloseTo(S55.h + 2 * 700, 6)
  })

  it("reports consistent totals, is deterministic and leaves unplaced / excluded alone", () => {
    const parts = randomParts(77, 60)
    parts.push(mk(3000, 3000, { id: "huge" }))
    for (const fc of FIRST_CUTS) {
      const r = nestParts(parts, S55, 3, { firstCut: fc })
      expect(r.cutCount).toBe(r.sheets.reduce((n, s) => n + s.cuts.length, 0))
      expect(r.cutLength).toBeCloseTo(r.sheets.reduce((n, s) => n + s.cuts.reduce((m, c) => m + c.length, 0), 0), 6)
      expect(r.unplaced.map((p) => p.id)).toContain("huge")
      expect(r.excluded.every((p) => p.shape === "cylinder")).toBe(true)
      expect(nestParts(parts, S55, 3, { firstCut: fc })).toEqual(r)
      expect(nestParts([...parts].reverse(), S55, 3, { firstCut: fc })).toEqual(r)
    }
    const empty = nestParts([], S48, 3)
    expect(empty.cutCount).toBe(0)
    expect(empty.cutLength).toBe(0)
  })
})
