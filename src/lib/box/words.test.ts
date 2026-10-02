import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { PART_TYPE_LABEL } from "./part-colors"
import { capitalize, dividerWord, lidWord, partTypeLabel } from "./words"
import { inToMm } from "./units"
import type { BoxInputs, LidType } from "./types"

const inputs = (o: Partial<BoxInputs> = {}): BoxInputs => ({
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
  ...o,
})

describe("words", () => {
  it("lidWord / dividerWord follow the lid position", () => {
    expect(lidWord("top")).toBe("lid")
    expect(lidWord("front")).toBe("door")
    expect(dividerWord("top")).toBe("divider")
    expect(dividerWord("front")).toBe("shelf")
  })

  it("capitalize upper-cases the first letter only", () => {
    expect(capitalize("door")).toBe("Door")
    expect(capitalize("lid leaf")).toBe("Lid leaf")
    expect(capitalize("Shelf")).toBe("Shelf")
    expect(capitalize("")).toBe("")
  })

  it("partTypeLabel", () => {
    expect(partTypeLabel("lid", "front")).toBe("Door")
    expect(partTypeLabel("divider", "front")).toBe("Shelves")
    expect(partTypeLabel("lid", "top")).toBe(PART_TYPE_LABEL.lid)
    expect(partTypeLabel("divider", "top")).toBe(PART_TYPE_LABEL.divider)
    expect(partTypeLabel("side", "front")).toBe(PART_TYPE_LABEL.side)
    expect(partTypeLabel("side", "top")).toBe(PART_TYPE_LABEL.side)
  })
})

describe("part names follow the lid position", () => {
  const lidNames = (lidPosition: "top" | "front", lidType: LidType, openLeaf: "first" | "second" = "second") =>
    buildBox(inputs({ lidPosition, lidType, openLeaf, dividers: 1 }))
      .parts.filter((p) => p.type === "lid")
      .map((p) => [p.id, p.name])

  it("top lid", () => {
    expect(lidNames("top", "full")).toEqual([["lid", "Lid"]])
    expect(lidNames("top", "split")).toEqual([["lid-first", "Lid leaf"], ["lid-second", "Lid leaf"]])
    expect(lidNames("top", "half", "first")).toEqual([["lid-first", "Lid (opening half)"], ["lid-second", "Lid (fixed half)"]])
    expect(lidNames("top", "half", "second")).toEqual([["lid-first", "Lid (fixed half)"], ["lid-second", "Lid (opening half)"]])
  })

  it("front lid", () => {
    expect(lidNames("front", "full")).toEqual([["lid", "Door"]])
    expect(lidNames("front", "split")).toEqual([["lid-first", "Door leaf"], ["lid-second", "Door leaf"]])
    expect(lidNames("front", "half", "first")).toEqual([["lid-first", "Door (opening half)"], ["lid-second", "Door (fixed half)"]])
    expect(lidNames("front", "half", "second")).toEqual([["lid-first", "Door (fixed half)"], ["lid-second", "Door (opening half)"]])
  })

  it("dividers are Divider on top and Shelf on the front; ids and types unchanged", () => {
    for (const [pos, name] of [["top", "Divider"], ["front", "Shelf"]] as const) {
      const divs = buildBox(inputs({ lidPosition: pos, dividers: 3 })).parts.filter((p) => p.type === "divider")
      expect(divs.map((p) => [p.id, p.name])).toEqual([1, 2, 3].map((n) => [`divider-${n}`, name]))
    }
  })
})
