import { describe, expect, it } from "vitest"

import { buildBox } from "./build"
import { toolsList } from "./tools-list"
import { inToMm } from "./units"
import type { BoxInputs } from "./types"

const base: BoxInputs = {
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: inToMm(0.71),
  lidPosition: "top",
  lidType: "full",
  openLeaf: "second",
  hingeSide: "long",
  bottomStyle: "inset",
  dividers: 0,
  legs: { style: "none", height: 101.6, diameter: 38.1, inset: 12.7, width: 76.2, footWidth: 38.1 },
  joinery: "butt",
}
const list = (over: Partial<BoxInputs> = {}, unit: "in" | "mm" = "in") => {
  const inputs = { ...base, ...over }
  return toolsList(inputs, buildBox(inputs), unit)
}

describe("toolsList", () => {
  it("lists the essentials first, then the optional ones", () => {
    const items = list()
    const firstOptional = items.findIndex((i) => !i.essential)
    expect(firstOptional).toBeGreaterThan(0)
    expect(items.slice(firstOptional).every((i) => !i.essential)).toBe(true)
    expect(items.slice(0, firstOptional).every((i) => i.essential)).toBe(true)
  })

  it("always includes a saw, a drill, clamps and safety gear", () => {
    const ids = list().map((i) => i.id)
    for (const id of ["saw", "drill", "clamps", "safety", "measure"]) expect(ids).toContain(id)
  })

  it("names the 1/8 inch pilot bit in inches and 3.2 mm in mm", () => {
    expect(list().find((i) => i.id === "drill")!.why).toContain('1/8"')
    expect(list({}, "mm").find((i) => i.id === "drill")!.why).toContain("3.2 mm")
  })

  it("adds leg-specific tools only for that leg style", () => {
    expect(list().some((i) => i.id === "dowel-ends" || i.id === "leg-clamps")).toBe(false)
    const dowel = { ...base.legs, style: "dowel" as const }
    const tapered = { ...base.legs, style: "tapered" as const }
    expect(list({ legs: dowel }).some((i) => i.id === "dowel-ends")).toBe(true)
    expect(list({ legs: tapered }).some((i) => i.id === "leg-clamps")).toBe(true)
  })

  it("is empty when the box can't be built", () => {
    expect(list({ dims: { w: 0, d: 0, h: 0 } })).toEqual([])
  })

  it("has unique ids and is deterministic", () => {
    const a = list()
    expect(new Set(a.map((i) => i.id)).size).toBe(a.length)
    expect(list()).toEqual(a)
  })
})
