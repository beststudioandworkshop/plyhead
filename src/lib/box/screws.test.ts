import { describe, it, expect } from "vitest"
import { MM_PER_INCH } from "./constants"
import { SCREW_TIERS, estimateJointLength, screwAdvice, screwCount } from "./screws"

const IN = MM_PER_INCH

describe("SCREW_TIERS", () => {
  it("good is 1 in bite / 8 in spacing, better is 1.5 in / 10 in", () => {
    expect(SCREW_TIERS.good.biteMm).toBeCloseTo(25.4, 9)
    expect(SCREW_TIERS.good.spacingMm).toBeCloseTo(8 * IN, 9)
    expect(SCREW_TIERS.better.biteMm).toBeCloseTo(38.1, 9)
    expect(SCREW_TIERS.better.spacingMm).toBeCloseTo(10 * IN, 9)
  })
})

describe("screwAdvice gauge and holes", () => {
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

  it("tier bite and spacing come from SCREW_TIERS", () => {
    const a = screwAdvice(18)
    expect(a.good.biteMm).toBe(SCREW_TIERS.good.biteMm)
    expect(a.good.spacingMm).toBe(SCREW_TIERS.good.spacingMm)
    expect(a.better.biteMm).toBe(SCREW_TIERS.better.biteMm)
    expect(a.better.spacingMm).toBe(SCREW_TIERS.better.spacingMm)
  })
})

describe("screwAdvice lengths", () => {
  const cases: Array<{
    t: number
    good: [number, number, number]
    better: [number, number, number]
  }> = [
    // [minLengthMm, lengthIn, lengthMetricMm]
    { t: 6, good: [31.4, 1.25, 35], better: [44.1, 1.75, 45] },
    { t: 11.94, good: [37.34, 1.5, 40], better: [50.04, 2, 60] },
    { t: 12, good: [37.4, 1.5, 40], better: [50.1, 2, 60] },
    { t: 18, good: [43.4, 1.75, 45], better: [56.1, 2.5, 60] },
    { t: 18.03, good: [43.43, 1.75, 45], better: [56.13, 2.5, 60] },
    { t: 40, good: [65.4, 3, 70], better: [78.1, 3.5, 80] },
  ]

  for (const c of cases) {
    it(`${c.t} mm`, () => {
      const a = screwAdvice(c.t)
      for (const tier of ["good", "better"] as const) {
        const [min, inch, metric] = c[tier]
        expect(a[tier].minLengthMm).toBeCloseTo(min, 9)
        expect(a[tier].lengthIn).toBe(inch)
        expect(a[tier].lengthMetricMm).toBe(metric)
      }
    })
  }

  it("18.034 mm: good 43.4 -> 1.75 in / 45 mm; better 56.1 -> 2.5 in / 60 mm", () => {
    const a = screwAdvice(18.034)
    expect(a.good.lengthIn).toBe(1.75)
    expect(a.good.lengthMetricMm).toBe(45)
    expect(a.better.lengthIn).toBe(2.5)
    expect(a.better.lengthMetricMm).toBe(60)
  })

  it("exact-fit lengths are not bumped up (imperial)", () => {
    // good: 25.4 + 25.4 = 50.8 = 2 in exactly
    expect(screwAdvice(25.4).good.lengthIn).toBe(2)
    // better: 12.7 + 38.1 = 50.8 = 2 in exactly
    expect(screwAdvice(12.7).better.lengthIn).toBe(2)
    // one hair over steps up to the next stock length
    expect(screwAdvice(25.5).good.lengthIn).toBe(2.5)
  })

  it("exact-fit lengths are not bumped up (metric)", () => {
    // good: 24.6 + 25.4 = 50 mm
    expect(screwAdvice(24.6).good.lengthMetricMm).toBe(50)
    // better: 11.9 + 38.1 = 50 mm
    expect(screwAdvice(11.9).better.lengthMetricMm).toBe(50)
    expect(screwAdvice(24.7).good.lengthMetricMm).toBe(60)
  })

  it("clamps to the largest stock length for very thick ply", () => {
    const a = screwAdvice(200)
    for (const tier of [a.good, a.better]) {
      expect(tier.lengthIn).toBe(4)
      expect(tier.lengthMetricMm).toBe(100)
    }
  })

  it("minLengthMm is thickness + bite, and stock meets it while stock lasts", () => {
    for (let t = 1; t <= 50; t += 0.5) {
      const a = screwAdvice(t)
      for (const tier of [a.good, a.better]) {
        expect(tier.minLengthMm).toBeCloseTo(t + tier.biteMm, 9)
        expect(tier.lengthIn * IN).toBeGreaterThanOrEqual(tier.minLengthMm - 1e-9)
        expect(tier.lengthMetricMm).toBeGreaterThanOrEqual(tier.minLengthMm - 1e-9)
      }
    }
  })

  it("better is always at least good in bite, length and spacing", () => {
    for (let t = 1; t <= 120; t += 0.25) {
      const { good, better } = screwAdvice(t)
      expect(better.biteMm).toBeGreaterThan(good.biteMm)
      expect(better.minLengthMm).toBeGreaterThan(good.minLengthMm)
      expect(better.lengthIn).toBeGreaterThanOrEqual(good.lengthIn)
      expect(better.lengthMetricMm).toBeGreaterThanOrEqual(good.lengthMetricMm)
      expect(better.spacingMm).toBeGreaterThan(good.spacingMm)
    }
  })

  it("is monotonic in thickness", () => {
    let prev = screwAdvice(1)
    for (let t = 1.25; t <= 120; t += 0.25) {
      const a = screwAdvice(t)
      for (const tier of ["good", "better"] as const) {
        expect(a[tier].minLengthMm).toBeGreaterThanOrEqual(prev[tier].minLengthMm)
        expect(a[tier].lengthIn).toBeGreaterThanOrEqual(prev[tier].lengthIn)
        expect(a[tier].lengthMetricMm).toBeGreaterThanOrEqual(prev[tier].lengthMetricMm)
      }
      expect(a.shankMm).toBeGreaterThanOrEqual(prev.shankMm)
      prev = a
    }
  })
})

describe("estimateJointLength", () => {
  const ext = { w: 18 * IN, d: 12 * IN, h: 10 * IN }

  it("top lid, no dividers: 4h + 2(w+d) = 100 in", () => {
    expect(estimateJointLength(ext, "top", 0)).toBeCloseTo(100 * IN, 6)
  })

  it("front lid adds w + 2d (42 in): 142 in", () => {
    expect(estimateJointLength(ext, "front", 0)).toBeCloseTo(142 * IN, 6)
  })

  it("2 dividers add 2 * 2h (40 in) each way: 140 in top, 182 in front", () => {
    expect(estimateJointLength(ext, "top", 2)).toBeCloseTo(140 * IN, 6)
    expect(estimateJointLength(ext, "front", 2)).toBeCloseTo(182 * IN, 6)
  })

  it("grows with each term", () => {
    const base = estimateJointLength(ext, "top", 0)
    expect(estimateJointLength({ ...ext, h: ext.h + 10 }, "top", 0)).toBeGreaterThan(base)
    expect(estimateJointLength({ ...ext, w: ext.w + 10 }, "top", 0)).toBeGreaterThan(base)
    expect(estimateJointLength({ ...ext, d: ext.d + 10 }, "top", 0)).toBeGreaterThan(base)
    expect(estimateJointLength(ext, "front", 0)).toBeGreaterThan(base)
    expect(estimateJointLength(ext, "top", 1)).toBeGreaterThan(base)
    expect(estimateJointLength(ext, "top", 2)).toBeGreaterThan(estimateJointLength(ext, "top", 1))
  })
})

describe("screwCount", () => {
  it("exact multiples need exactly that many", () => {
    expect(screwCount(100, 25)).toBe(4)
    expect(screwCount(8 * IN * 5, 8 * IN)).toBe(5)
  })

  it("one more screw once past a multiple", () => {
    expect(screwCount(100.01, 25)).toBe(5)
    expect(screwCount(1, 25)).toBe(1)
  })

  it("zero length needs no screws", () => {
    expect(screwCount(0, 25)).toBe(0)
  })

  it("better spacing needs fewer screws than good for the same joints", () => {
    const len = estimateJointLength({ w: 18 * IN, d: 12 * IN, h: 10 * IN }, "top", 0)
    expect(screwCount(len, SCREW_TIERS.better.spacingMm)).toBeLessThanOrEqual(
      screwCount(len, SCREW_TIERS.good.spacingMm),
    )
  })
})
