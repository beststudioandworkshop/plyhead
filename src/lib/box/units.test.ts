import { describe, it, expect } from "vitest"
import {
  formatInches,
  formatLength,
  formatMillimetres,
  formatThickness,
  inToMm,
  mmToIn,
  parseLength,
} from "./units"

describe("parseLength", () => {
  it.each([
    ["12", "in", 304.8],
    ["12", "mm", 12],
    ["12.5", "in", 317.5],
    ["12.5", "mm", 12.5],
    [".5", "in", 12.7],
    ["3/4", "in", 19.05],
    ["3/4", "mm", 0.75],
    ["1 1/2", "in", 38.1],
    ["1 1/2", "mm", 1.5],
    ["1-1/2", "in", 38.1],
    ['1 1/2"', "in", 38.1],
    ['1 1/2"', "mm", 38.1],
    ["1.5in", "mm", 38.1],
    ["1.5in", "in", 38.1],
    ["1.5 inch", "mm", 38.1],
    ["25.4mm", "in", 25.4],
    ["25.4mm", "mm", 25.4],
    ["12 mm", "in", 12],
    ["12 mm", "mm", 12],
    ["  12  ", "mm", 12],
    ["1,000", "mm", 1000],
    ["12 MM", "in", 12],
  ] as const)("parses %j (default %s) -> %f mm", (text, unit, expected) => {
    expect(parseLength(text, unit)).toBeCloseTo(expected, 6)
  })

  it.each(["", "   ", "abc", "mm", '"', "1/0", "1 1/0", "-5", "1..2", "12 foo", "1/2/3", "NaN"])(
    "returns null for %j",
    (text) => {
      expect(parseLength(text, "in")).toBeNull()
      expect(parseLength(text, "mm")).toBeNull()
    },
  )
})

describe("formatInches", () => {
  it.each([
    [1.5, '1 1/2"'],
    [0.75, '3/4"'],
    [0, '0"'],
    [0.875, '7/8"'],
    [15 / 16, '15/16"'],
    [1 / 16, '1/16"'],
    [0.5, '1/2"'],
    [0.25, '1/4"'],
    [2, '2"'],
    [18, '18"'],
    [10.3125, '10 5/16"'],
  ])("%f in -> %s", (inches, text) => {
    expect(formatInches(inToMm(inches))).toBe(text)
  })

  it("rounds to the nearest 1/16", () => {
    expect(formatInches(inToMm(0.03))).toBe('0"')
    expect(formatInches(inToMm(0.04))).toBe('1/16"')
    expect(formatInches(inToMm(1.99))).toBe('2"')
    expect(formatInches(inToMm(0.71))).toBe('11/16"')
    expect(formatInches(inToMm(0.47))).toBe('1/2"')
  })

  it("omits the suffix when asked", () => {
    expect(formatInches(inToMm(1.5), false)).toBe("1 1/2")
    expect(formatInches(0, false)).toBe("0")
  })

  it("handles negatives", () => {
    expect(formatInches(-inToMm(0.5))).toBe('-1/2"')
    expect(formatInches(-inToMm(1.5))).toBe('-1 1/2"')
    expect(formatInches(-0.001)).toBe('0"')
  })
})

describe("formatMillimetres / formatThickness / formatLength", () => {
  it("formats millimetres with trimmed decimals", () => {
    expect(formatMillimetres(12)).toBe("12 mm")
    expect(formatMillimetres(12.34)).toBe("12.3 mm")
    expect(formatMillimetres(12.34, false)).toBe("12.3")
    expect(formatMillimetres(12.34, true, 2)).toBe("12.34 mm")
  })

  it("shows thickness as decimals, not fractions", () => {
    expect(formatThickness(inToMm(0.71), "in")).toBe('0.71"')
    expect(formatThickness(inToMm(0.47), "in")).toBe('0.47"')
    expect(formatThickness(inToMm(0.75), "in", false)).toBe("0.75")
    expect(formatThickness(18, "mm")).toBe("18 mm")
    expect(formatThickness(11.1, "mm", false)).toBe("11.1")
  })

  it("formatLength dispatches on unit", () => {
    expect(formatLength(inToMm(1.5), "in")).toBe('1 1/2"')
    expect(formatLength(inToMm(1.5), "in", false)).toBe("1 1/2")
    expect(formatLength(38.1, "mm")).toBe("38.1 mm")
    expect(formatLength(38.1, "mm", false)).toBe("38.1")
  })
})

describe("conversions", () => {
  it("inToMm / mmToIn", () => {
    expect(inToMm(1)).toBeCloseTo(25.4, 9)
    expect(mmToIn(25.4)).toBeCloseTo(1, 9)
  })
  it("round-trips", () => {
    for (const v of [0, 0.47, 1, 17.3125, 1234.5]) {
      expect(mmToIn(inToMm(v))).toBeCloseTo(v, 9)
      expect(inToMm(mmToIn(v))).toBeCloseTo(v, 9)
    }
  })
  it("format -> parse round trips on 1/16 values", () => {
    for (const inches of [0.0625, 0.5, 1.5, 10.3125, 18]) {
      expect(parseLength(formatInches(inToMm(inches)), "mm")).toBeCloseTo(inToMm(inches), 6)
    }
  })
})
