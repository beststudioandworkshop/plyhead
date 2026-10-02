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

  it("part colours are pairwise distinct", () => {
    const all = Object.values(PART_COLORS)
    expect(new Set(all).size).toBe(all.length)
  })

  it("the hinge line stands out against the lid it is drawn on", () => {
    // It is only ever drawn on a lid, so it may share a colour with a part that is never next to it.
    expect(HINGE_COLOR).not.toBe(PART_COLORS.lid)
  })

  it("labels are distinct", () => {
    const l = Object.values(PART_TYPE_LABEL)
    expect(new Set(l).size).toBe(l.length)
  })
})
