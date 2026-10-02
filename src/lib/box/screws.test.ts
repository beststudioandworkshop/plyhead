import { describe, it, expect } from "vitest"
import { MM_PER_INCH } from "./constants"
import { SCREW_BITE_MM, screwAdvice } from "./screws"

describe("screwAdvice", () => {
  it("bite is 25 mm", () => {
    expect(SCREW_BITE_MM).toBe(25)
  })

  it("minLength is thickness + 25", () => {
    for (const t of [6, 12, 18, 40]) expect(screwAdvice(t).minLengthMm).toBe(t + 25)
  })

  it("gauge is #6 below 10 mm, otherwise #8", () => {
    expect(screwAdvice(6).gauge).toBe("#6")
    expect(screwAdvice(9.99).gauge).toBe("#6")
    expect(screwAdvice(10).gauge).toBe("#8")
    expect(screwAdvice(18).gauge).toBe("#8")
  })

  it("hole sizes follow the gauge", () => {
    const thin = screwAdvice(6)
    const thick = screwAdvice(18)
    expect([thin.shankMm, thin.pilotMm, thin.clearanceMm]).toEqual([3.5, 2.5, 3.5])
    expect([thick.shankMm, thick.pilotMm, thick.clearanceMm]).toEqual([4.2, 3, 4.2])
  })

  it("spacing is 100-150 mm", () => {
    expect(screwAdvice(18).spacingMm).toEqual([100, 150])
  })

  it("11.94 mm (about 0.47 in): min 36.94 -> 1.5 in, 40 mm", () => {
    const a = screwAdvice(11.94)
    expect(a.minLengthMm).toBeCloseTo(36.94, 9)
    expect(a.lengthIn).toBe(1.5) // 38.1 mm
    expect(a.lengthMetricMm).toBe(40)
  })

  it("12 mm: min 37 -> 1.5 in, 40 mm", () => {
    const a = screwAdvice(12)
    expect(a.lengthIn).toBe(1.5)
    expect(a.lengthMetricMm).toBe(40)
  })

  it("18 mm: min 43 -> 1.75 in (44.45 mm), 45 mm", () => {
    const a = screwAdvice(18)
    expect(a.minLengthMm).toBe(43)
    expect(a.lengthIn).toBe(1.75)
    expect(a.lengthMetricMm).toBe(45)
  })

  it("18.03 mm: min 43.03 -> still 1.75 in, 45 mm", () => {
    const a = screwAdvice(18.03)
    expect(a.lengthIn).toBe(1.75)
    expect(a.lengthMetricMm).toBe(45)
  })

  it("6 mm: min 31 -> 1.25 in (31.75 mm), 35 mm", () => {
    const a = screwAdvice(6)
    expect(a.minLengthMm).toBe(31)
    expect(a.lengthIn).toBe(1.25)
    expect(a.lengthMetricMm).toBe(35)
  })

  it("40 mm: min 65 -> 3 in (the largest imperial), 70 mm", () => {
    const a = screwAdvice(40)
    expect(a.minLengthMm).toBe(65)
    expect(a.lengthIn).toBe(3)
    expect(a.lengthMetricMm).toBe(70)
  })

  it("an exact stock length is not bumped up (25 mm bite + 5 mm = 30 mm)", () => {
    expect(screwAdvice(5).lengthMetricMm).toBe(30)
  })

  it("clamps to the largest stock length for very thick ply", () => {
    const a = screwAdvice(200)
    expect(a.lengthIn).toBe(3)
    expect(a.lengthMetricMm).toBe(80)
  })

  it("recommended lengths are at least the minimum while stock lasts", () => {
    for (let t = 1; t <= 50; t += 0.5) {
      const a = screwAdvice(t)
      expect(a.lengthIn * MM_PER_INCH).toBeGreaterThanOrEqual(a.minLengthMm - 1e-9)
      expect(a.lengthMetricMm).toBeGreaterThanOrEqual(a.minLengthMm - 1e-9)
    }
  })

  it("is monotonic in thickness", () => {
    let prev = screwAdvice(1)
    for (let t = 1.25; t <= 120; t += 0.25) {
      const a = screwAdvice(t)
      expect(a.minLengthMm).toBeGreaterThanOrEqual(prev.minLengthMm)
      expect(a.lengthIn).toBeGreaterThanOrEqual(prev.lengthIn)
      expect(a.lengthMetricMm).toBeGreaterThanOrEqual(prev.lengthMetricMm)
      expect(a.shankMm).toBeGreaterThanOrEqual(prev.shankMm)
      prev = a
    }
  })
})
