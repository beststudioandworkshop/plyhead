import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { buildDxf, layerName, SHEET_LAYER } from "./dxf"
import { DEFAULT_KERF_MM, SHEET_PRESETS } from "./constants"
import { nestParts } from "./nesting"
import type { BoxInputs, Part } from "./types"
import { inToMm } from "./units"

const S48 = SHEET_PRESETS.find((s) => s.id === "4x8")!

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

const plate = (over: Partial<Part> = {}): Part => ({
  id: "x",
  name: "Plate",
  type: "side",
  length: 100,
  width: 50,
  thickness: 18,
  center: [0, 0, 0],
  rotation: [0, 0, 0],
  extents: [100, 18, 50],
  shape: "box",
  grain: null,
  ...over,
})

interface Ent {
  type: string
  layer: string
  nums: Record<string, number[]>
}

/** Minimal DXF reader: entities from the ENTITIES section with their layer and numeric codes. */
function entities(dxf: string): Ent[] {
  const lines = dxf.split(/\r?\n/)
  const out: Ent[] = []
  let inEnt = false
  let cur: Ent | null = null
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim()
    const val = lines[i + 1].trim()
    if (code === "0" && val === "SECTION") continue
    if (code === "2" && val === "ENTITIES") {
      inEnt = true
      continue
    }
    if (!inEnt) continue
    if (code === "0") {
      if (val === "ENDSEC") break
      cur = { type: val, layer: "", nums: {} }
      out.push(cur)
    } else if (cur) {
      if (code === "8") cur.layer = val
      else (cur.nums[code] ??= []).push(Number(val))
    }
  }
  return out
}

const lineXY = (e: Ent): [number, number][] => [
  [e.nums["10"][0], e.nums["20"][0]],
  [e.nums["11"][0], e.nums["21"][0]],
]

describe("layerName", () => {
  it("is the upper-cased part type", () => {
    expect(layerName("side")).toBe("SIDE")
    expect(layerName("leg")).toBe("LEG")
    expect(layerName("lid")).toBe("LID")
    expect(SHEET_LAYER).toBe("SHEET")
  })
})

describe("buildDxf", () => {
  it("returns a valid DXF for an empty nest", async () => {
    const nest = nestParts([], S48, 3)
    const dxf = await buildDxf(nest, [], { unit: "mm" })
    expect(dxf).toContain("SECTION")
    expect(dxf).toContain("ENTITIES")
    expect(dxf).toContain("EOF")
    expect(entities(dxf)).toHaveLength(0)
  })

  it("draws a default top-lid box with dowels and no LEG layer", async () => {
    const res = buildBox(boxInputs("dowel"))
    const nest = nestParts(res.parts, S48, DEFAULT_KERF_MM)
    const dxf = await buildDxf(nest, res.parts, { unit: "mm" })
    expect(dxf).toContain("SECTION")
    expect(dxf).toContain("ENTITIES")
    expect(dxf).toContain("EOF")
    const layers = new Set(entities(dxf).map((e) => e.layer))
    expect(layers.has("SHEET")).toBe(true)
    for (const t of new Set(nest.sheets.flatMap((s) => s.placements.map((p) => p.type)))) {
      expect(layers.has(layerName(t))).toBe(true)
    }
    expect(layers.has("LEG")).toBe(false)
    // every nested rectangle (+ the sheet) is 4 LINEs
    const placed = nest.sheets.reduce((n, s) => n + s.placements.length, 0)
    expect(entities(dxf).filter((e) => e.type === "LINE")).toHaveLength(4 * (placed + nest.sheets.length))
  })

  it("draws tapered legs on the LEG layer (4 edges per quad plate)", async () => {
    const res = buildBox(boxInputs("tapered"))
    const nest = nestParts(res.parts, S48, DEFAULT_KERF_MM)
    const dxf = await buildDxf(nest, res.parts, { unit: "mm" })
    const ents = entities(dxf)
    const legs = ents.filter((e) => e.layer === "LEG")
    const legParts = res.parts.filter((p) => p.type === "leg")
    expect(legParts).toHaveLength(8)
    expect(legs.length).toBe(legParts.reduce((n, p) => n + p.outline!.length, 0))
    expect(ents.filter((e) => e.layer === "SHEET")).toHaveLength(4 * nest.sheets.length)
  })

  it("scales inches by 1/25.4 relative to mm", async () => {
    const p = plate({ id: "a", length: 254, width: 127 })
    const nest = nestParts([p], S48, 3)
    const mm = entities(await buildDxf(nest, [p], { unit: "mm" })).filter((e) => e.layer === "SIDE")
    const inch = entities(await buildDxf(nest, [p], { unit: "in" })).filter((e) => e.layer === "SIDE")
    expect(mm).toHaveLength(4)
    const xs = mm.flatMap(lineXY).map((v) => v[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(254, 3)
    mm.forEach((e, i) => {
      lineXY(e).forEach((v, j) => {
        expect(lineXY(inch[i])[j][0] * 25.4).toBeCloseTo(v[0], 3)
        expect(lineXY(inch[i])[j][1] * 25.4).toBeCloseTo(v[1], 3)
      })
    })
  })

  it("flips y so the first placement sits at the top of the sheet", async () => {
    const p = plate({ id: "a", length: 200, width: 100 })
    const nest = nestParts([p], S48, 3)
    const ys = entities(await buildDxf(nest, [p], { unit: "mm" }))
      .filter((e) => e.layer === "SIDE")
      .flatMap(lineXY)
      .map((v) => v[1])
    expect(Math.max(...ys)).toBeCloseTo(S48.h, 3)
    expect(Math.min(...ys)).toBeCloseTo(S48.h - 100, 3)
  })

  it("offsets later sheets by sheet width plus the gap", async () => {
    const parts = [plate({ id: "a", length: 2400, width: 1200 }), plate({ id: "b", length: 2400, width: 1200 })]
    const nest = nestParts(parts, S48, 3)
    expect(nest.sheets).toHaveLength(2)
    const dxf = await buildDxf(nest, parts, { unit: "mm", sheetGap: 100 })
    const xs = entities(dxf)
      .filter((e) => e.layer === "SHEET")
      .flatMap(lineXY)
      .map((v) => v[0])
    expect(Math.min(...xs)).toBeCloseTo(0, 3)
    expect(Math.max(...xs)).toBeCloseTo(2 * S48.w + 100, 3)
  })

  it("fills the swapped footprint with a rotated polygon plate", async () => {
    // Trapezoid 300 long x 100 wide at the top, narrowing to 40.
    const p = plate({
      id: "poly",
      type: "leg",
      shape: "polygon",
      length: 300,
      width: 100,
      outline: [
        [-150, 50],
        [150, 50],
        [150, 10],
        [-150, -50],
      ],
    })
    // 300 x 100 on a sheet 1219 wide: force rotation with a sheet that is narrow.
    const narrow = { ...S48, w: 150, h: 400 }
    const nest = nestParts([p], narrow, 3)
    const pl = nest.sheets[0].placements[0]
    expect(pl.rotated).toBe(true)
    expect(pl.w).toBe(100)
    expect(pl.h).toBe(300)
    const dxf = await buildDxf(nest, [p], { unit: "mm" })
    const pts = entities(dxf)
      .filter((e) => e.layer === "LEG")
      .flatMap(lineXY)
    expect(pts).toHaveLength(8)
    const xs = pts.map((v) => v[0])
    const ys = pts.map((v) => v[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 3)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(300, 3)
    expect(Math.min(...xs)).toBeCloseTo(pl.x, 3)
    expect(Math.min(...ys)).toBeCloseTo(narrow.h - pl.y - pl.h, 3)
  })
})
