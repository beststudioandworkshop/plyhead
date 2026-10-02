import { describe, expect, it } from "vitest"

import { buildBox } from "./build"
import { cutListToCsv, cutListToText, groupParts } from "./cutlist"
import { inToMm } from "./units"
import type { BoxInputs } from "./types"

const base: BoxInputs = {
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: inToMm(1 / 8),
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  hingeSide: "long",
  openLeaf: "second",
  legs: { style: "none", height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  bottomStyle: "inset",
  dividers: 0,
  joinery: "butt",
}

describe("groupParts", () => {
  it("groups the two sides and the four dowels", () => {
    const r = buildBox({ ...base, legs: { ...base.legs, style: "dowel" } })
    const rows = groupParts(r.parts)
    expect(rows.find((x) => x.name === "Side")?.quantity).toBe(2)
    const dowels = rows.filter((x) => x.name === "Dowel leg")
    expect(dowels).toHaveLength(1)
    expect(dowels[0].quantity).toBe(4)
    expect(dowels[0].type).toBe("leg")
    expect(dowels[0].partIds).toEqual(["leg-1", "leg-2", "leg-3", "leg-4"])
    expect(dowels[0].length).toBeCloseTo(100, 6)
    expect(rows.reduce((n, x) => n + x.quantity, 0)).toBe(r.parts.length)
  })

  it("tapered legs: plate A x4 and plate B x4 are separate rows", () => {
    const r = buildBox({ ...base, legs: { ...base.legs, style: "tapered" } })
    const rows = groupParts(r.parts)
    const a = rows.filter((x) => x.name === "Leg plate A")
    const b = rows.filter((x) => x.name === "Leg plate B")
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0].quantity).toBe(4)
    expect(b[0].quantity).toBe(4)
    expect(a[0].width).toBeCloseTo(76, 6)
    expect(b[0].width).toBeCloseTo(76 - 18, 6)
    expect(a[0].partIds).toHaveLength(4)
    expect(rows.reduce((n, x) => n + x.quantity, 0)).toBe(r.parts.length)
  })

  it("groups by name as well as cut size", () => {
    const [p] = buildBox(base).parts
    const rows = groupParts([p, { ...p, id: "x", name: "Other" }, { ...p, id: "y" }])
    expect(rows.map((x) => [x.name, x.quantity])).toEqual([
      [p.name, 2],
      ["Other", 1],
    ])
  })

  it("keeps split leaves together but fixed/opening halves separate", () => {
    const split = groupParts(buildBox({ ...base, lidType: "split" }).parts)
    expect(split.find((x) => x.name === "Lid leaf")?.quantity).toBe(2)
    const half = groupParts(buildBox({ ...base, lidType: "half" }).parts)
    expect(half.filter((x) => x.name.startsWith("Lid"))).toHaveLength(2)
  })
})

describe("exports", () => {
  const rows = groupParts(buildBox(base).parts)

  it("CSV has a header, one line per row, and exact mm columns", () => {
    const lines = cutListToCsv(rows, "in").trim().split("\r\n")
    expect(lines[0]).toBe("Part,Qty,Length,Width,Thickness,Length mm,Width mm,Thickness mm")
    expect(lines).toHaveLength(rows.length + 1)
    expect(lines.find((l) => l.startsWith("Lid,"))).toContain("457.20")
  })

  it("quotes cells containing commas or quotes", () => {
    const csv = cutListToCsv([{ ...rows[0], name: 'He said "hi", ok' }], "mm")
    expect(csv).toContain('"He said ""hi"", ok"')
  })

  it("text export is one line per row", () => {
    expect(cutListToText(rows, "in").split("\n")).toHaveLength(rows.length)
  })
})

describe("groupParts with dividers", () => {
  it.each([1, 2, 3])("%i dividers group into one Divider row of that quantity", (n) => {
    const r = buildBox({ ...base, dividers: n })
    expect(r.ok).toBe(true)
    const rows = groupParts(r.parts).filter((x) => x.name === "Divider")
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(n)
    expect(rows[0].type).toBe("divider")
    expect(rows[0].partIds).toEqual(Array.from({ length: n }, (_, i) => `divider-${i + 1}`))
    expect(groupParts(r.parts).reduce((s, x) => s + x.quantity, 0)).toBe(r.parts.length)
  })

  it("bounds are unchanged by dividers", () => {
    expect(buildBox({ ...base, dividers: 3 }).bounds).toEqual(buildBox(base).bounds)
  })
})
