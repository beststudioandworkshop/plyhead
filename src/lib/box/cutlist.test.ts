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
  openLeaf: "right",
  legs: { face: null, height: 100, section: 38, inset: 12 },
  joinery: "butt",
}

describe("groupParts", () => {
  it("groups the two sides and the four legs", () => {
    const r = buildBox({ ...base, legs: { ...base.legs, face: "bottom" } })
    const rows = groupParts(r.parts)
    expect(rows.find((x) => x.name === "Side")?.quantity).toBe(2)
    expect(rows.find((x) => x.name === "Leg")?.quantity).toBe(4)
    expect(rows.reduce((n, x) => n + x.quantity, 0)).toBe(r.parts.length)
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
