import { describe, it, expect } from "vitest"
import { buildBox, resolveDimensions } from "./build"
import { buildLid } from "./lid"
import { JOINERY } from "./joinery"
import { groupParts } from "./cutlist"
import { explodeOffset, centerOf } from "./explode"
import { openSpecs } from "./open"
import { hardwareList } from "./hardware"
import { toolsList } from "./tools-list"
import { requestBody } from "./request"
import { decodeShare, encodeShare, type ShareState } from "./share"
import { nestParts } from "./nesting"
import { buildDxf } from "./dxf"
import { dividerAxis } from "./dividers"
import { DEFAULT_KERF_MM, SHEET_PRESETS } from "./constants"
import type { BottomStyle, BoxInputs, BoxResult, LegStyle, LidPosition, Part, Unit, Vec3 } from "./types"
import { inToMm } from "./units"

const S48 = SHEET_PRESETS.find((s) => s.id === "4x8")!

const make = (o: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "none",
  openLeaf: "second",
  hingeSide: "long",
  bottomStyle: "inset",
  dividers: 0,
  legs: { style: "none", height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  joinery: "butt",
  ...o,
})
const legs = (style: LegStyle) => ({ style, height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 })

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const vol = (p: Part) => p.extents[0] * p.extents[1] * p.extents[2]
const overlaps = (a: Part, b: Part) => {
  const [al, ah, bl, bh] = [lo(a), hi(a), lo(b), hi(b)]
  return [0, 1, 2].every((i) => Math.min(ah[i], bh[i]) - Math.max(al[i], bl[i]) > 1e-4)
}
const solid = (r: BoxResult) => r.parts.filter((p) => p.type !== "leg")
const near = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2))

const sizes: { label: string; unit: Unit; w: number; d: number; h: number }[] = [
  { label: "in", unit: "in", w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  { label: "mm", unit: "mm", w: 400, d: 250, h: 180 },
]
const thicknesses = [7.3, 12, 18, inToMm(0.71)]
const positions: LidPosition[] = ["top", "front"]
const bottoms: BottomStyle[] = ["inset", "lap"]

describe("none: joinery dimensions", () => {
  const ext = { w: 400, d: 250, h: 180 }
  const t = 18
  const j = JOINERY.butt
  it("open top loses t on height only", () => {
    expect(j.interiorFromExterior(ext, t, "top", false)).toEqual({ w: 364, d: 214, h: 162 })
    expect(j.exteriorFromInterior({ w: 364, d: 214, h: 162 }, t, "top", false)).toEqual(ext)
  })
  it("open front loses t on depth only", () => {
    expect(j.interiorFromExterior(ext, t, "front", false)).toEqual({ w: 364, d: 232, h: 144 })
    expect(j.exteriorFromInterior({ w: 364, d: 232, h: 144 }, t, "front", false)).toEqual(ext)
  })
  it("with a lid every dimension loses 2t", () => {
    for (const p of positions) expect(j.interiorFromExterior(ext, t, p, true)).toEqual({ w: 364, d: 214, h: 144 })
  })
  it("interiorBox opens out to the open side", () => {
    expect(j.interiorBox(ext, t, "top", false)).toEqual({ min: [18, 18, 18], max: [382, 180, 232] })
    expect(j.interiorBox(ext, t, "front", false)).toEqual({ min: [18, 18, 18], max: [382, 162, 250] })
  })
  it("lidSlab is null without a lid, present with one", () => {
    for (const p of positions) for (const b of bottoms) {
      expect(j.layout(ext, t, p, b, false).lidSlab).toBeNull()
      expect(j.layout(ext, t, p, b, true).lidSlab).not.toBeNull()
    }
  })
  it("buildLid and openSpecs are empty", () => {
    const slab = { min: [0, 0, 0] as Vec3, max: [10, 10, 10] as Vec3 }
    for (const p of positions) expect(buildLid(slab, p, "none", "first", "long")).toEqual([])
    expect(openSpecs([], "top").size).toBe(0)
  })
})

describe("none: part layout", () => {
  const box = (p: Part) => ({ min: lo(p), max: hi(p) })
  const get = (r: BoxResult, id: string) => r.parts.find((p) => p.id === id)!
  const W = 400, D = 250, H = 180, t = 18
  const dims = { w: W, d: D, h: H }

  it("open top, inset", () => {
    const r = buildBox(make({ dims }))
    expect(r.ok).toBe(true)
    expect(r.parts.map((p) => p.id).sort()).toEqual(["back", "bottom", "front", "left", "right"])
    near(lo(get(r, "left")), [0, 0, 0]); near(hi(get(r, "left")), [t, H, D])
    near(lo(get(r, "right")), [W - t, 0, 0]); near(hi(get(r, "right")), [W, H, D])
    near(lo(get(r, "back")), [t, 0, 0]); near(hi(get(r, "back")), [W - t, H, t])
    near(lo(get(r, "front")), [t, 0, D - t]); near(hi(get(r, "front")), [W - t, H, D])
    near(lo(get(r, "bottom")), [t, 0, t]); near(hi(get(r, "bottom")), [W - t, t, D - t])
    expect(box(get(r, "left")).max[1]).toBe(H)
  })
  it("open top, lap", () => {
    const r = buildBox(make({ dims, bottomStyle: "lap" }))
    near(lo(get(r, "left")), [0, t, 0]); near(hi(get(r, "left")), [t, H, D])
    near(lo(get(r, "back")), [t, t, 0]); near(hi(get(r, "back")), [W - t, H, t])
    near(lo(get(r, "front")), [t, t, D - t])
    near(lo(get(r, "bottom")), [0, 0, 0]); near(hi(get(r, "bottom")), [W, t, D])
  })
  it("open front, inset", () => {
    const r = buildBox(make({ dims, lidPosition: "front" }))
    expect(r.parts.map((p) => p.id).sort()).toEqual(["back", "bottom", "left", "right", "top"])
    near(lo(get(r, "left")), [0, 0, 0]); near(hi(get(r, "left")), [t, H, D])
    near(lo(get(r, "back")), [t, 0, 0]); near(hi(get(r, "back")), [W - t, H, t])
    near(lo(get(r, "top")), [t, H - t, t]); near(hi(get(r, "top")), [W - t, H, D])
    near(lo(get(r, "bottom")), [t, 0, t]); near(hi(get(r, "bottom")), [W - t, t, D])
  })
  it("open front, lap", () => {
    const r = buildBox(make({ dims, lidPosition: "front", bottomStyle: "lap" }))
    near(lo(get(r, "left")), [0, t, 0]); near(hi(get(r, "left")), [t, H, D])
    near(lo(get(r, "back")), [t, t, 0])
    near(lo(get(r, "top")), [t, H - t, t]); near(hi(get(r, "top")), [W - t, H, D])
    near(lo(get(r, "bottom")), [0, 0, 0]); near(hi(get(r, "bottom")), [W, t, D])
  })
})

describe("none: matrix of valid solids", () => {
  for (const size of sizes)
    for (const position of positions)
      for (const bottomStyle of bottoms)
        for (const thickness of thicknesses)
          for (const style of ["none", "dowel", "tapered"] as LegStyle[])
            for (let dividers = 0; dividers <= 3; dividers++) {
              const label = `${size.label} ${position} ${bottomStyle} t=${thickness.toFixed(2)} legs=${style} dividers=${dividers}`
              it(label, () => {
                const inp = make({
                  dims: { w: size.w, d: size.d, h: size.h },
                  lidPosition: position,
                  bottomStyle,
                  thickness,
                  dividers,
                  legs: legs(style),
                })
                const r = buildBox(inp)
                expect(r.issues).toEqual([])
                expect(r.ok).toBe(true)
                const t = thickness
                const { w: W, d: D, h: H } = r.exterior
                // interior dims
                const openTop = position === "top"
                expect(r.interior.w).toBeCloseTo(W - 2 * t, 6)
                expect(r.interior.d).toBeCloseTo(openTop ? D - 2 * t : D - t, 6)
                expect(r.interior.h).toBeCloseTo(openTop ? H - t : H - 2 * t, 6)

                // no lids, no hinges
                const parts = solid(r)
                expect(r.parts.some((p) => p.type === "lid")).toBe(false)
                expect(r.parts.some((p) => p.hinge)).toBe(false)
                if (position === "top") expect(r.parts.some((p) => p.type === "top")).toBe(false)

                // inside the exterior
                for (const p of parts) {
                  const a = lo(p), b = hi(p)
                  expect(a[0]).toBeGreaterThanOrEqual(-1e-4)
                  expect(a[1]).toBeGreaterThanOrEqual(-1e-4)
                  expect(a[2]).toBeGreaterThanOrEqual(-1e-4)
                  expect(b[0]).toBeLessThanOrEqual(W + 1e-4)
                  expect(b[1]).toBeLessThanOrEqual(H + 1e-4)
                  expect(b[2]).toBeLessThanOrEqual(D + 1e-4)
                }
                // no overlaps
                for (let i = 0; i < parts.length; i++)
                  for (let j = i + 1; j < parts.length; j++)
                    expect(overlaps(parts[i], parts[j]), `${parts[i].id} x ${parts[j].id}`).toBe(false)

                // volume: carcass = exterior - interior (the open side isn't filled)
                const carcass = parts.filter((p) => p.type !== "divider").reduce((s, p) => s + vol(p), 0)
                const interiorVol = r.interior.w * r.interior.d * r.interior.h
                expect(carcass).toBeCloseTo(W * D * H - interiorVol, 0)

                // dividers: full-lid behaviour, span the open interior
                const divs = parts.filter((p) => p.type === "divider")
                expect(divs).toHaveLength(dividers)
                const ib = JOINERY.butt.interiorBox(r.exterior, t, position, false)
                const axis = dividerAxis(ib, position, "none")
                if (position === "front") expect(axis).toBe(1)
                else expect(axis).toBe(r.interior.w >= r.interior.d ? 0 : 2)
                for (const d of divs) {
                  expect(d.extents[axis]).toBeCloseTo(t, 3)
                  for (const a of [0, 1, 2]) {
                    if (a === axis) continue
                    expect(d.extents[a]).toBeCloseTo(ib.max[a] - ib.min[a], 3)
                  }
                  if (axis !== 1) expect(hi(d)[1]).toBeCloseTo(openTop ? H : H - t, 3)
                  if (axis !== 2) expect(hi(d)[2]).toBeCloseTo(openTop ? D - t : D, 3)
                }
                if (dividers > 0) {
                  const divVol = divs.reduce((s, p) => s + vol(p), 0)
                  expect(divVol).toBeCloseTo(
                    dividers * t * (r.interior.w * r.interior.d * r.interior.h) / (axis === 0 ? r.interior.w : axis === 1 ? r.interior.h : r.interior.d),
                    0,
                  )
                }

                // bounds include legs
                if (style === "none") {
                  near(r.bounds.min, [0, 0, 0]); near(r.bounds.max, [W, H, D])
                } else {
                  expect(r.bounds.min[1]).toBeLessThan(0)
                }
              })
            }
})

describe("none: dividers have no seam rule", () => {
  it("accepts 2 dividers on an open top", () => {
    for (const n of [1, 2, 3]) expect(buildBox(make({ dividers: n })).ok).toBe(true)
  })
  it("a split lid still rejects 2", () => {
    const r = buildBox(make({ lidType: "split", dividers: 2 }))
    expect(r.ok).toBe(false)
    expect(r.issues[0].code).toBe("dividers-need-seam")
  })
  it("too many dividers for the span still fail with no room", () => {
    const r = buildBox(make({ dims: { w: 100, d: 90, h: 100 }, thickness: 18, dividers: 3 }))
    expect(r.ok).toBe(false)
    expect(r.issues[0].code).toBe("dividers-no-room")
  })
  it("divider names: Divider on top, Shelf on front", () => {
    expect(buildBox(make({ dividers: 1 })).parts.find((p) => p.type === "divider")!.name).toBe("Divider")
    expect(buildBox(make({ dividers: 1, lidPosition: "front" })).parts.find((p) => p.type === "divider")!.name).toBe("Shelf")
  })
})

describe("none: interior-too-small", () => {
  const t = 18
  it("open top: height <= t fails, just above t works", () => {
    for (const h of [t, t / 2]) {
      const r = buildBox(make({ dims: { w: 200, d: 200, h } }))
      expect(r.ok).toBe(false)
      expect(r.issues[0].code).toBe("interior-too-small")
      expect(r.parts).toEqual([])
    }
    expect(buildBox(make({ dims: { w: 200, d: 200, h: t + 1 } })).ok).toBe(true)
    // the same height would fail with a lid (needs > 2t)
    expect(buildBox(make({ lidType: "full", dims: { w: 200, d: 200, h: t + 1 } })).issues[0].code).toBe("interior-too-small")
  })
  it("open front: depth <= t fails, just above works", () => {
    expect(buildBox(make({ lidPosition: "front", dims: { w: 200, d: t, h: 200 } })).issues[0].code).toBe("interior-too-small")
    expect(buildBox(make({ lidPosition: "front", dims: { w: 200, d: t + 1, h: 200 } })).ok).toBe(true)
  })
  it("width must still exceed 2t", () => {
    expect(buildBox(make({ dims: { w: 2 * t, d: 200, h: 200 } })).issues[0].code).toBe("interior-too-small")
    expect(buildBox(make({ lidPosition: "front", dims: { w: 2 * t, d: 200, h: 200 } })).issues[0].code).toBe("interior-too-small")
  })
  it("open top: depth must exceed 2t; open front: height must exceed 2t", () => {
    expect(buildBox(make({ dims: { w: 200, d: 2 * t, h: 200 } })).ok).toBe(false)
    expect(buildBox(make({ lidPosition: "front", dims: { w: 200, d: 200, h: 2 * t } })).ok).toBe(false)
  })
})

describe("none: resolveDimensions", () => {
  for (const position of positions)
    for (const thickness of thicknesses) {
      it(`${position} t=${thickness.toFixed(2)}: interior mode round trips`, () => {
        const interior = { w: 300.5, d: 200.25, h: 150 }
        const c = 4.5
        const inp = make({ dimensionMode: "interior", dims: interior, clearance: c, thickness, lidPosition: position })
        const { exterior, interior: i } = resolveDimensions(inp)
        expect(i).toEqual({ w: interior.w + c, d: interior.d + c, h: interior.h + c })
        expect(exterior.w).toBeCloseTo(interior.w + c + 2 * thickness, 9)
        expect(exterior.d).toBeCloseTo(interior.d + c + (position === "top" ? 2 : 1) * thickness, 9)
        expect(exterior.h).toBeCloseTo(interior.h + c + (position === "top" ? 1 : 2) * thickness, 9)
        const r = buildBox(inp)
        expect(r.ok).toBe(true)
        expect(r.interior.w).toBeCloseTo(interior.w + c, 6)
        expect(r.interior.d).toBeCloseTo(interior.d + c, 6)
        expect(r.interior.h).toBeCloseTo(interior.h + c, 6)
        // exterior mode on the resolved exterior gives the same interior back
        const back = resolveDimensions(make({ dims: exterior, thickness, lidPosition: position }))
        expect(back.interior.w).toBeCloseTo(i.w, 9)
        expect(back.interior.d).toBeCloseTo(i.d, 9)
        expect(back.interior.h).toBeCloseTo(i.h, 9)
      })
    }
  it("exterior mode keeps the exterior", () => {
    const { exterior } = resolveDimensions(make({ dims: { w: 300, d: 200, h: 100 } }))
    expect(exterior).toEqual({ w: 300, d: 200, h: 100 })
  })
})

describe("none: cut list, explode, hardware, tools", () => {
  it("cut list names (no lid/door rows)", () => {
    const top = groupParts(buildBox(make({ dividers: 2 })).parts)
    expect(top.map((r) => [r.name, r.quantity]).sort()).toEqual(
      [["Back", 1], ["Bottom", 1], ["Divider", 2], ["Front", 1], ["Side", 2]].sort(),
    )
    const front = groupParts(buildBox(make({ lidPosition: "front", dividers: 2 })).parts)
    expect(front.map((r) => [r.name, r.quantity]).sort()).toEqual(
      [["Back", 1], ["Bottom", 1], ["Shelf", 2], ["Side", 2], ["Top", 1]].sort(),
    )
    for (const r of [...top, ...front]) expect(r.type).not.toBe("lid")
  })
  it("every part's id is covered by the grouped rows", () => {
    const r = buildBox(make({ dividers: 3, legs: legs("dowel") }))
    expect(groupParts(r.parts).flatMap((x) => x.partIds).sort()).toEqual(r.parts.map((p) => p.id).sort())
  })
  it("explode moves each panel along one axis, away from the centre", () => {
    for (const position of positions) {
      const r = buildBox(make({ lidPosition: position, dividers: 1 }))
      const c = centerOf(r.bounds)
      for (const p of r.parts) {
        const o = explodeOffset(p, c, 50)
        const nz = o.filter((v) => v !== 0)
        if (p.type === "divider") expect(nz).toHaveLength(0)
        else expect(nz).toHaveLength(1)
      }
    }
  })
  it("hardware has no hinge or lid/door items", () => {
    for (const position of positions)
      for (const bottomStyle of bottoms) {
        const inp = make({ lidPosition: position, bottomStyle, legs: legs("dowel") })
        const items = hardwareList(inp, buildBox(inp), "in")
        expect(items.some((i) => i.category === "hinges" || i.category === "lid")).toBe(false)
        expect(items.some((i) => i.id.startsWith("hinge") || i.id.startsWith("lid"))).toBe(false)
        expect(items.some((i) => i.id === "screws-main")).toBe(true)
        expect(items.find((i) => i.id === "leg-dowel")?.qty).toBe(4)
      }
  })
  it("hardware for an invalid none box is empty", () => {
    const inp = make({ dims: { w: 200, d: 200, h: 10 } })
    expect(hardwareList(inp, buildBox(inp), "mm")).toEqual([])
  })
  it("tools list drops the chisel only when there's no lid", () => {
    const none = make()
    expect(toolsList(none, buildBox(none), "in").some((i) => i.id === "chisel")).toBe(false)
    const full = make({ lidType: "full" })
    expect(toolsList(full, buildBox(full), "in").some((i) => i.id === "chisel")).toBe(true)
    const front = make({ lidPosition: "front" })
    expect(toolsList(front, buildBox(front), "mm").some((i) => i.id === "chisel")).toBe(false)
  })
})

describe("none: request text", () => {
  const body = (o: Partial<BoxInputs>) => {
    const inp = make(o)
    const r = buildBox(inp)
    return requestBody({
      kind: "kit",
      contact: { name: "Sam", email: "s@e.com", zip: "97201", notes: "" },
      inputs: inp,
      exterior: r.exterior,
      interior: r.interior,
      unit: "in",
      link: "https://example.com/x",
    })
  }
  it("open top", () => {
    const b = body({})
    expect(b).toContain("Opening: open top (no lid)")
    expect(b).not.toMatch(/^Lid:/m)
    expect(b).not.toContain("hinged")
    expect(b).toContain("Dividers: 0")
  })
  it("open front", () => {
    const b = body({ lidPosition: "front", dividers: 2 })
    expect(b).toContain("Opening: open front (no door)")
    expect(b).not.toMatch(/^Door:/m)
    expect(b).toContain("Shelves: 2")
  })
  it("keeps the Lid line when there is a lid", () => {
    expect(body({ lidType: "full" })).toMatch(/^Lid: top, full, hinged on the long side/m)
  })
})

describe("none: share", () => {
  const state = (o: Partial<BoxInputs>): ShareState => ({
    inputs: make(o),
    unit: "mm",
    rounding: "exact",
    sheetId: "4x8",
    kerfMm: 3.175,
    thicknessPreset: "custom",
  })
  it("round-trips lidType none in both positions", () => {
    for (const lidPosition of positions)
      for (let dividers = 0; dividers <= 3; dividers++) {
        const s = state({ lidPosition, dividers, dims: { w: 400, d: 250, h: 180 } })
        const out = decodeShare(encodeShare(s))
        expect(out).toEqual(s)
        expect(out!.inputs.lidType).toBe("none")
      }
  })
  it("still rejects unknown lid types", () => {
    const enc = encodeShare(state({}))
    const json = atob(enc.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (enc.length % 4)) % 4))
    const bad = btoa(json.replace('"lt":"none"', '"lt":"nope"')).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    expect(decodeShare(bad)).toBeNull()
  })
})

describe("none: nesting and DXF", () => {
  for (const position of positions)
    for (const style of ["none", "dowel", "tapered"] as LegStyle[]) {
      it(`${position} legs=${style}: nests every sheet part`, async () => {
        const inp = make({ lidPosition: position, dividers: 2, legs: legs(style), bottomStyle: "lap" })
        const r = buildBox(inp)
        const nest = nestParts(r.parts, S48, DEFAULT_KERF_MM)
        expect(nest.unplaced).toEqual([])
        const placed = nest.sheets.flatMap((s) => s.placements)
        const sheetGoods = r.parts.filter((p) => p.shape !== "cylinder")
        expect(placed).toHaveLength(sheetGoods.length)
        expect(nest.excluded).toHaveLength(r.parts.length - sheetGoods.length)
        const dxf = await buildDxf(nest, r.parts, { unit: "mm" })
        expect(dxf).toContain("ENTITIES")
        expect(dxf).toContain("EOF")
      })
    }
})
