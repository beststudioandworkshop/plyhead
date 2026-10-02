import { describe, it, expect } from "vitest"
import { encodeShare, decodeShare, shareUrl, type ShareState } from "./share"
import { MAX_DIVIDERS, THICKNESS_PRESETS } from "./constants"
import type { BoxInputs, LegStyle } from "./types"

const b64u = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const baseInputs = (o: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: 457.2, d: 304.8, h: 254 },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  openLeaf: "second",
  hingeSide: "long",
  bottomStyle: "inset",
  dividers: 0,
  legs: { style: "none", height: 101.6, diameter: 38.1, inset: 12.7, width: 76.2, footWidth: 38.1 },
  joinery: "butt",
  ...o,
})

const baseState = (o: Partial<ShareState> = {}): ShareState => ({
  inputs: baseInputs(),
  unit: "in",
  rounding: "exact",
  sheetId: "4x8",
  kerfMm: 3.175,
  thicknessPreset: "custom",
  ...o,
})

/** The "good" wire object, for building tampered payloads. */
const wire = () => JSON.parse(atob(encodeShare(baseState()).replace(/-/g, "+").replace(/_/g, "/")))
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at untyped wire data
const tampered = (mutate: (w: any) => void) => {
  const w = wire()
  mutate(w)
  return b64u(JSON.stringify(w))
}

describe("encode / decode round trip", () => {
  it("round-trips every enum combination", () => {
    let n = 0
    for (const dimensionMode of ["exterior", "interior"] as const)
      for (const lidPosition of ["top", "front"] as const)
        for (const lidType of ["full", "split", "half", "none"] as const)
          for (const openLeaf of ["first", "second"] as const)
            for (const hingeSide of ["long", "short"] as const)
              for (const bottomStyle of ["inset", "lap"] as const)
                for (const unit of ["in", "mm"] as const)
                  for (const rounding of ["exact", "easier"] as const)
                    for (const sheetId of ["4x8", "5x5"] as const) {
                      const s = baseState({
                        inputs: baseInputs({ dimensionMode, lidPosition, lidType, openLeaf, hingeSide, bottomStyle }),
                        unit,
                        rounding,
                        sheetId,
                      })
                      expect(decodeShare(encodeShare(s))).toEqual(s)
                      n++
                    }
    expect(n).toBe(2 * 2 * 4 * 2 * 2 * 2 * 2 * 2 * 2)
  })

  it("round-trips leg styles, dividers and thickness presets", () => {
    for (const style of ["none", "dowel", "tapered"] as LegStyle[])
      for (let dividers = 0; dividers <= MAX_DIVIDERS; dividers++)
        for (const thicknessPreset of ["custom", ...THICKNESS_PRESETS.map((p) => p.id)]) {
          const s = baseState({
            inputs: baseInputs({ dividers, legs: { ...baseInputs().legs, style } }),
            thicknessPreset,
          })
          expect(decodeShare(encodeShare(s))).toEqual(s)
        }
  })

  it("rounds numbers to 3 decimals", () => {
    const s = baseState({
      inputs: baseInputs({ dims: { w: 100.123456, d: 200.9996, h: 50.0004 }, thickness: 17.99999 }),
      kerfMm: 3.17549,
    })
    const out = decodeShare(encodeShare(s))!
    expect(out.inputs.dims).toEqual({ w: 100.123, d: 201, h: 50 })
    expect(out.inputs.thickness).toBe(18)
    expect(out.kerfMm).toBe(3.175)
  })

  it("accepts boundary values", () => {
    const s = baseState({
      inputs: baseInputs({
        dims: { w: 1, d: 10000, h: 1 },
        clearance: 0,
        thickness: 100,
        dividers: MAX_DIVIDERS,
        legs: { style: "dowel", height: 2000, diameter: 500, inset: 0, width: 1000, footWidth: 1 },
      }),
      kerfMm: 20,
    })
    expect(decodeShare(encodeShare(s))).toEqual(s)
  })

  it("is URL-safe, short and deterministic", () => {
    const s = baseState({ inputs: baseInputs({ legs: { ...baseInputs().legs, style: "tapered" } }) })
    const e = encodeShare(s)
    expect(e).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(e.length).toBeLessThan(600)
    expect(encodeShare(s)).toBe(e)
  })

  it("does not mutate its input", () => {
    const s = baseState()
    const copy = structuredClone(s)
    encodeShare(s)
    expect(s).toEqual(copy)
  })
})

describe("decodeShare rejects bad input without throwing", () => {
  const bad: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["garbage", "!!!not base64!!!"],
    ["short garbage", "a"],
    ["non-string", 42],
    ["base64 of non-JSON", b64u("hello world")],
    ["base64 of JSON null", b64u("null")],
    ["base64 of JSON array", b64u("[1,2]")],
    ["invalid utf-8", "_w"],
    ["standard base64 chars", "ab+/cd=="],
    ["wrong version", tampered((w) => (w.v = 2))],
    ["missing version", tampered((w) => delete w.v)],
    ["string version", tampered((w) => (w.v = "1"))],
    ["missing inputs", tampered((w) => delete w.i)],
    ["missing dims", tampered((w) => delete w.i.d)],
    ["missing legs", tampered((w) => delete w.i.l)],
    ["missing field", tampered((w) => delete w.i.th)],
    ["missing top-level field", tampered((w) => delete w.k)],
    ["bad unit", tampered((w) => (w.u = "cm"))],
    ["bad rounding", tampered((w) => (w.r = "round"))],
    ["bad sheet", tampered((w) => (w.s = "6x6"))],
    ["bad thickness preset", tampered((w) => (w.t = "nope"))],
    ["bad dimension mode", tampered((w) => (w.i.m = "outer"))],
    ["bad lid type", tampered((w) => (w.i.lt = "nope"))],
    ["bad joinery", tampered((w) => (w.i.j = "dado"))],
    ["bad leg style", tampered((w) => (w.i.l.s = "wheels"))],
    ["inherited enum name", tampered((w) => (w.u = "toString"))],
    ["dims too small", tampered((w) => (w.i.d.w = 0.5))],
    ["dims too large", tampered((w) => (w.i.d.h = 10001))],
    ["negative clearance", tampered((w) => (w.i.c = -1))],
    ["thickness too large", tampered((w) => (w.i.th = 101))],
    ["kerf too large", tampered((w) => (w.k = 21))],
    ["leg height too large", tampered((w) => (w.i.l.h = 2001))],
    ["negative inset", tampered((w) => (w.i.l.i = -1))],
    ["dividers over max", tampered((w) => (w.i.dv = MAX_DIVIDERS + 1))],
    ["fractional dividers", tampered((w) => (w.i.dv = 1.5))],
    ["NaN as string", tampered((w) => (w.i.th = "NaN"))],
    ["numeric string", tampered((w) => (w.i.d.w = "100"))],
    ["null number", tampered((w) => (w.k = null))],
    ["wrong type for inputs", tampered((w) => (w.i = "x"))],
    ["array for dims", tampered((w) => (w.i.d = [1, 2, 3]))],
    ["__proto__ root", b64u('{"__proto__":{"v":1}}')],
    ["huge input", "A".repeat(100000)],
    ["just over limit", "A".repeat(2001)],
  ]
  for (const [name, value] of bad) {
    it(name, () => {
      expect(() => decodeShare(value as string)).not.toThrow()
      expect(decodeShare(value as string)).toBeNull()
    })
  }

  it("out-of-range via exponent overflow (Infinity)", () => {
    const e = b64u(JSON.stringify(wire()).replace('"k":3.175', '"k":1e999'))
    expect(decodeShare(e)).toBeNull()
  })
})

describe("decodeShare sanitises", () => {
  it("drops unknown keys at every level", () => {
    const e = tampered((w) => {
      w.extra = 1
      w.i.extra = { a: 1 }
      w.i.d.extra = 2
      w.i.l.extra = 3
    })
    const out = decodeShare(e)!
    expect(out).toEqual(baseState())
    expect(Object.keys(out).sort()).toEqual(["inputs", "kerfMm", "rounding", "sheetId", "thicknessPreset", "unit"])
    expect(Object.keys(out.inputs.dims).sort()).toEqual(["d", "h", "w"])
    expect(Object.keys(out.inputs.legs).sort()).toEqual(
      ["diameter", "footWidth", "height", "inset", "style", "width"],
    )
  })

  it("is prototype-pollution safe", () => {
    const raw = JSON.stringify(wire()).replace(
      /^\{/,
      '{"__proto__":{"polluted":true,"u":"mm"},"constructor":{"prototype":{"polluted":true}},',
    )
    const out = decodeShare(b64u(raw))!
    expect(out).toEqual(baseState())
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect((out as unknown as Record<string, unknown>).polluted).toBeUndefined()
  })

  it("does not take inherited values for missing fields", () => {
    const e = tampered((w) => delete w.u)
    expect(decodeShare(e)).toBeNull()
  })
})

describe("shareUrl", () => {
  it("formats origin + path + d param", () => {
    const s = baseState()
    expect(shareUrl("https://example.com", s)).toBe(`https://example.com/tools/box?d=${encodeShare(s)}`)
  })

  it("decodes back from the query value", () => {
    const s = baseState({ unit: "mm" })
    const d = new URL(shareUrl("https://x.test", s)).searchParams.get("d")
    expect(decodeShare(d)).toEqual(s)
  })
})
