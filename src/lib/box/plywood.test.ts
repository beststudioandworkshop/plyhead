import { describe, expect, it } from "vitest"

import { plyCount } from "./plywood"

describe("plyCount", () => {
  it("is always odd and at least 3", () => {
    for (let t = 0; t <= 60; t += 0.5) {
      const n = plyCount(t)
      expect(n % 2).toBe(1)
      expect(n).toBeGreaterThanOrEqual(3)
    }
  })

  it("matches typical sheets", () => {
    expect(plyCount(6)).toBe(3)
    expect(plyCount(11.938)).toBe(5)
    expect(plyCount(12)).toBe(7)
    expect(plyCount(18)).toBe(9)
    expect(plyCount(18.034)).toBe(9)
  })

  it("never decreases as the plywood gets thicker", () => {
    let prev = 0
    for (let t = 1; t <= 80; t += 0.25) {
      const n = plyCount(t)
      expect(n).toBeGreaterThanOrEqual(prev)
      prev = n
    }
  })

  it("is capped, and copes with bad input", () => {
    expect(plyCount(1000)).toBe(21)
    expect(plyCount(0)).toBe(3)
    expect(plyCount(-5)).toBe(3)
    expect(plyCount(Number.NaN)).toBe(3)
  })
})
