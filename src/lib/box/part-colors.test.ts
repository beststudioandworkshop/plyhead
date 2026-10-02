import { describe, it, expect } from "vitest"
import { HINGE_COLOR, PART_COLORS, PART_TYPE_LABEL } from "./part-colors"
import type { PartType } from "./types"

const TYPES: PartType[] = ["side", "front", "back", "top", "bottom", "lid", "leg", "divider"]

describe("part palette", () => {
  it("has a colour and a label for every part type", () => {
    for (const t of TYPES) {
      expect(PART_COLORS[t], t).toBeTruthy()
      expect(PART_TYPE_LABEL[t], t).toBeTruthy()
    }
    expect(Object.keys(PART_COLORS).sort()).toEqual([...TYPES].sort())
    expect(Object.keys(PART_TYPE_LABEL).sort()).toEqual([...TYPES].sort())
  })

  it("colours are pairwise distinct and differ from the hinge colour", () => {
    const all = [...Object.values(PART_COLORS), HINGE_COLOR]
    expect(new Set(all).size).toBe(all.length)
  })

  it("labels are distinct", () => {
    const l = Object.values(PART_TYPE_LABEL)
    expect(new Set(l).size).toBe(l.length)
  })
})
