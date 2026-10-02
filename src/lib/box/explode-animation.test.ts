import { describe, expect, it } from "vitest"

import { EXPLODE_STAGGER, easeInOutCubic, partProgress } from "./explode"
import type { PartType } from "./types"

const TYPES: PartType[] = ["lid", "top", "divider", "side", "front", "back", "bottom", "leg"]

describe("explode animation staging", () => {
  it("every part is home at t=0 and fully out at t=1", () => {
    for (const type of TYPES) {
      expect(partProgress(0, type)).toBe(0)
      expect(partProgress(1, type)).toBe(1)
    }
  })

  it("is monotonic in t for every part", () => {
    for (const type of TYPES) {
      let prev = -1
      for (let i = 0; i <= 100; i++) {
        const p = partProgress(i / 100, type)
        expect(p).toBeGreaterThanOrEqual(prev)
        prev = p
      }
    }
  })

  it("exploding goes lid first, then walls, then bottom, then legs", () => {
    // Part-way through, earlier parts are further along than later ones.
    const t = 0.5
    const order = ["lid", "top", "divider", "side", "bottom", "leg"] as PartType[]
    for (let i = 1; i < order.length; i++) {
      expect(partProgress(t, order[i - 1])).toBeGreaterThanOrEqual(partProgress(t, order[i]))
    }
    expect(partProgress(t, "lid")).toBeGreaterThan(partProgress(t, "leg"))
  })

  it("collapsing runs in reverse: at the same t the lid is still out while legs are home", () => {
    expect(partProgress(EXPLODE_STAGGER, "leg")).toBe(0)
    expect(partProgress(EXPLODE_STAGGER, "lid")).toBeGreaterThan(0)
  })

  it("front, back and sides move together", () => {
    for (const t of [0.2, 0.5, 0.8]) {
      expect(partProgress(t, "front")).toBe(partProgress(t, "side"))
      expect(partProgress(t, "back")).toBe(partProgress(t, "side"))
    }
  })

  it("easeInOutCubic is 0 and 1 at the ends, 0.5 at the middle, and symmetric", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12)
    for (const x of [0.1, 0.3, 0.45]) {
      expect(easeInOutCubic(x) + easeInOutCubic(1 - x)).toBeCloseTo(1, 12)
    }
  })
})
