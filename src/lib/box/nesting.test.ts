import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { DEFAULT_KERF_MM, SHEET_PRESETS } from "./constants"
import { nestParts, nestableParts, type NestResult } from "./nesting"
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
