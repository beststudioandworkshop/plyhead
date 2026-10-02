import { describe, it, expect } from "vitest"
import { diyEstimate, dominoCount, kitEstimate, type KitRates, type PriceBook } from "./estimate"
import type { HardwareItem } from "./hardware"

const prices = (v: number): PriceBook => ({
  sheet: { "4x8": v, "5x5": v * 2 },
  buttHingeEach: v,
  continuousHingePerMeter: v,
  lidStayEach: v,
  lidSupportEach: v,
  pullEach: v,
  magneticCatchEach: v,
  dowelEach: v,
  legFastenerEach: v,
  screwEach: v,
  glue: v,
  pilotBit: v,
  finishAllowance: v,
})
const rates: KitRates = {
  perPartCut: 2,
  perDomino: 3,
  dominoSpacingMm: 100,
  dominosMinimum: 10,
  perPilotHole: 0.5,
  packing: 7,
  shipping: 20,
}
const item = (id: string, qty: number, meta?: HardwareItem["meta"]): HardwareItem => ({
  id,
  category: "hinges",
  name: id,
  spec: "",
  qty,
  meta,
})
const hw = [
  item("hinge-butt-2in", 3),
  item("lid-support", 1),
  item("lid-pull", 1),
  item("screws-main", 40),
  item("glue", 1),
  item("pilot-bit", 1),
]
const line = (e: { lines: { id: string }[] }, id: string) => e.lines.find((l) => l.id === id) as never as {
  qty: number
  unitPrice: number
  total: number
}

describe("dominoCount", () => {
  it("ceils by spacing and respects the minimum", () => {
    expect(dominoCount(1000, 100, 0)).toBe(10)
    expect(dominoCount(1001, 100, 0)).toBe(11)
    expect(dominoCount(999, 100, 0)).toBe(10)
    expect(dominoCount(100, 100, 10)).toBe(10)
    expect(dominoCount(1500, 100, 10)).toBe(15)
    expect(dominoCount(0, 100, 8)).toBe(8)
    expect(dominoCount(500, 0, 8)).toBe(8)
  })
})

describe("diyEstimate", () => {
  it("prices every line at 1", () => {
    const e = diyEstimate({ sheets: 2, sheetId: "4x8", hardware: hw, prices: prices(1) })
    expect(e.lines.map((l) => l.id)).toEqual([
      "plywood",
      "hinge-butt-2in",
      "lid-support",
      "lid-pull",
      "screws-main",
      "glue",
      "pilot-bit",
      "finish",
    ])
    // 2 + 3 + 1 + 1 + 40 + 1 + 1 + 1
    expect(e.total).toBe(50)
  })

  it("uses the 5x5 price and the override", () => {
    expect(line(diyEstimate({ sheets: 3, sheetId: "5x5", hardware: [], prices: prices(10) }), "plywood").total).toBe(60)
    const o = diyEstimate({ sheets: 3, sheetId: "5x5", hardware: [], prices: prices(10), sheetPriceOverride: 55.5 })
    expect(line(o, "plywood")).toMatchObject({ unitPrice: 55.5, total: 166.5 })
    expect(o.total).toBe(176.5)
  })

  it("zero sheets costs nothing for plywood", () => {
    const e = diyEstimate({ sheets: 0, sheetId: "4x8", hardware: [], prices: prices(100) })
    expect(line(e, "plywood").total).toBe(0)
    expect(e.total).toBe(100)
  })

  it("prices continuous hinges by length", () => {
    const e = diyEstimate({
      sheets: 0,
      sheetId: "4x8",
      hardware: [item("hinge-continuous-762", 2, { lengthMm: 762 })],
      prices: { ...prices(0), continuousHingePerMeter: 10 },
    })
    expect(line(e, "hinge-continuous-762")).toMatchObject({ qty: 2, unitPrice: 7.62, total: 15.24 })
    expect(e.total).toBe(15.24)
  })

  it("total equals the sum of line totals, in cents", () => {
    const p = { ...prices(1.337), continuousHingePerMeter: 3.333 }
    const e = diyEstimate({
      sheets: 3,
      sheetId: "4x8",
      hardware: [...hw, item("hinge-continuous-457", 1, { lengthMm: 457.2 })],
      prices: p,
    })
    const sum = Math.round(e.lines.reduce((n, l) => n + l.total, 0) * 100) / 100
    expect(e.total).toBe(sum)
    for (const l of e.lines) expect(Math.round(l.total * 100)).toBeCloseTo(l.total * 100, 6)
  })

  it("is deterministic", () => {
    const a = { sheets: 2, sheetId: "4x8" as const, hardware: hw, prices: prices(3) }
    expect(diyEstimate(a)).toEqual(diyEstimate(a))
  })
})

describe("kitEstimate", () => {
  const base = {
    sheets: 2,
    sheetId: "4x8" as const,
    sheetParts: 8,
    jointLengthMm: 2000,
    pilotHoles: 40,
    includeHardware: true,
    hardware: hw,
    prices: prices(1),
    rates,
  }

  it("builds the lines with simple numbers", () => {
    const e = kitEstimate(base)
    expect(e.dominos).toBe(20)
    expect(e.lines.map((l) => l.id)).toEqual([
      "plywood",
      "cutting",
      "dominos",
      "pilot-holes",
      "hardware",
      "packing",
      "shipping",
    ])
    expect(line(e, "plywood").total).toBe(2)
    expect(line(e, "cutting").total).toBe(16)
    expect(line(e, "dominos").total).toBe(60)
    expect(line(e, "pilot-holes").total).toBe(20)
    expect(line(e, "hardware").total).toBe(47) // 3+1+1+40+1
    expect(e.total).toBe(2 + 16 + 60 + 20 + 47 + 7 + 20)
  })

  it("leaves hardware out when not included", () => {
    const e = kitEstimate({ ...base, includeHardware: false })
    expect(e.lines.some((l) => l.id === "hardware")).toBe(false)
    expect(e.total).toBe(2 + 16 + 60 + 20 + 7 + 20)
  })

  it("applies the domino minimum, sheet override, and zero sheets", () => {
    expect(kitEstimate({ ...base, jointLengthMm: 100 }).dominos).toBe(10)
    const o = kitEstimate({ ...base, sheetPriceOverride: 80 })
    expect(line(o, "plywood").total).toBe(160)
    const z = kitEstimate({ ...base, sheets: 0 })
    expect(line(z, "plywood").total).toBe(0)
  })

  it("totals equal the sum of lines and are deterministic", () => {
    const e = kitEstimate({ ...base, prices: prices(1.337), jointLengthMm: 1234 })
    expect(e.total).toBe(Math.round(e.lines.reduce((n, l) => n + l.total, 0) * 100) / 100)
    expect(kitEstimate(base)).toEqual(kitEstimate(base))
  })

  it("prices continuous hinges by length inside the hardware line", () => {
    const e = kitEstimate({
      ...base,
      hardware: [item("hinge-continuous-500", 1, { lengthMm: 500 })],
      prices: { ...prices(1), continuousHingePerMeter: 10 },
    })
    expect(line(e, "hardware").total).toBe(5)
  })
})
