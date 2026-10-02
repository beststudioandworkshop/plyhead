import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { MIN_DIVIDER_GAP_MM, SPAN_SUGGEST_RATIO } from "./constants"
import { dividerAxis, dividerGap, suggestDivider, validateDividers } from "./dividers"
import { JOINERY } from "./joinery"
import type { Axis, Box, BoxInputs, HingeSide, LidPosition, LidType, Part, Vec3 } from "./types"
import { inToMm } from "./units"

const inputs = (overrides: Partial<BoxInputs> = {}): BoxInputs => ({
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
  ...overrides,
})

const T = 18
const EXT = { w: inToMm(18), d: inToMm(12), h: inToMm(10) }
const LIDS: LidPosition[] = ["top", "front"]
const TYPES: LidType[] = ["full", "split", "half"]
const SIDES: HingeSide[] = ["long", "short"]
const DIMS = [
  EXT,
  { w: 200, d: 400, h: 300 },
  { w: 400, d: 200, h: 300 },
  { w: 300, d: 300, h: 500 },
  { w: 500, d: 300, h: 300 },
]

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const overlaps = (a: Part, b: Part) => {
  const [al, ah, bl, bh] = [lo(a), hi(a), lo(b), hi(b)]
  return [0, 1, 2].every((i) => Math.min(ah[i], bh[i]) - Math.max(al[i], bl[i]) > 1e-4)
}
const sizeOf = (b: Box): Vec3 => [0, 1, 2].map((a) => b.max[a] - b.min[a]) as Vec3
const interiorOf = (dims: typeof EXT): Box => JOINERY.butt.interiorBox(dims, T)
const near = (a: number, b: number, d = 2) => expect(a).toBeCloseTo(b, d)

/** Independent expectation of the divider axis. */
function expectedAxis(dims: typeof EXT, lid: LidPosition, type: LidType): Axis {
  const i = sizeOf(interiorOf(dims))
  if (type !== "full") return 0 // split/half lids always divide across x, whatever the hinge side or lid
  const [a, b]: [Axis, Axis] = lid === "top" ? [0, 2] : [0, 1]
  return i[a] >= i[b] ? a : b
}

describe("dividerAxis", () => {
  const cases: [(typeof EXT), LidPosition, LidType, HingeSide][] = []
  for (const d of DIMS) for (const l of LIDS) for (const t of TYPES) for (const h of SIDES) cases.push([d, l, t, h])

  it.each(cases)("%o %s %s %s", (dims, lid, type) => {
    expect(dividerAxis(interiorOf(dims), lid, type)).toBe(expectedAxis(dims, lid, type))
  })

  it("full top lid on 18x12x10in: x is the longer axis", () => {
    expect(dividerAxis(interiorOf(EXT), "top", "full")).toBe(0)
    expect(dividerAxis(interiorOf(EXT), "top", "full")).toBe(0)
  })

  it("full lid ignores hingeSide and picks z when depth is the longer top-plane span", () => {
    const dims = { w: 200, d: 400, h: 300 }
    expect(dividerAxis(interiorOf(dims), "top", "full")).toBe(2)
    expect(dividerAxis(interiorOf(dims), "top", "full")).toBe(2)
  })

  it("full front lid compares x against y; tie goes to x", () => {
    expect(dividerAxis(interiorOf({ w: 200, d: 300, h: 400 }), "front", "full")).toBe(1)
    expect(dividerAxis(interiorOf({ w: 300, d: 200, h: 300 }), "front", "full")).toBe(0)
    expect(dividerAxis(interiorOf({ w: 300, d: 300, h: 200 }), "top", "full")).toBe(0)
  })

  it("split/half lids always use x, independent of lid position and (non-existent) hinge side", () => {
    for (const dims of DIMS)
      for (const lid of LIDS)
        for (const type of ["split", "half"] as const) expect(dividerAxis(interiorOf(dims), lid, type)).toBe(0)
    // including non-square boxes where z or y is the long lid edge
    expect(dividerAxis(interiorOf({ w: 200, d: 400, h: 300 }), "top", "split")).toBe(0)
    expect(dividerAxis(interiorOf({ w: 200, d: 300, h: 400 }), "front", "half")).toBe(0)
  })
})

describe("dividerGap", () => {
  it("is (span - n t) / (n + 1)", () => {
    expect(dividerGap(100, 1, 10)).toBe(45)
    expect(dividerGap(100, 3, 10)).toBe(17.5)
  })
})

describe("built dividers", () => {
  const cases: [(typeof EXT), LidPosition, LidType, HingeSide, number][] = []
  for (const d of DIMS) for (const l of LIDS) for (const t of TYPES) for (const h of SIDES) for (const n of [1, 2, 3]) cases.push([d, l, t, h, n])

  it.each(cases)("%o %s %s %s x%i: names, placement and no overlaps", (dims, lidPosition, lidType, hingeSide, n) => {
    const r = buildBox(inputs({ dims, lidPosition, lidType, hingeSide, dividers: n }))
    expect(r.ok).toBe(true)
    const divs = r.parts.filter((p) => p.type === "divider")
    expect(divs.map((p) => p.id)).toEqual(Array.from({ length: n }, (_, i) => `divider-${i + 1}`))
    for (const p of divs) {
      expect(p.name).toBe("Divider")
      expect(p.thickness).toBeCloseTo(T, 6)
      expect(p.shape).toBe("box")
    }

    const axis = expectedAxis(dims, lidPosition, lidType)
    if (lidType !== "full") expect(axis).toBe(0)
    const ib = interiorOf(dims)
    const span = ib.max[axis] - ib.min[axis]
    const gap = (span - n * T) / (n + 1)

    // thin along the divider axis and spans the interior on the other two
    for (const p of divs) {
      near(p.extents[axis], T)
      for (let a = 0; a < 3; a++) {
        if (a === axis) continue
        near(lo(p)[a], ib.min[a])
        near(hi(p)[a], ib.max[a])
      }
    }
    // equal clear gaps
    divs.forEach((p, i) => near(lo(p)[axis], ib.min[axis] + (i + 1) * gap + i * T))
    near(ib.max[axis] - hi(divs[n - 1])[axis], gap)
    for (let i = 1; i < n; i++) near(lo(divs[i])[axis] - hi(divs[i - 1])[axis], gap)

    // n=1 is centred; under the seam for split/half lids
    if (n === 1) {
      near(divs[0].center[axis], (ib.min[axis] + ib.max[axis]) / 2)
      if (lidType !== "full") {
        const lids = r.parts.filter((p) => p.type === "lid")
        const seam = hi(lids.find((p) => p.id === "lid-first")!)[axis]
        near(divs[0].center[axis], seam)
        near(divs[0].center[0], dims.w / 2)
        near(lo(lids.find((p) => p.id === "lid-second")!)[axis], seam)
      }
    }

    // never overlaps anything
    for (const d of divs)
      for (const p of r.parts) {
        if (p === d) continue
        expect(overlaps(d, p), `${d.id} vs ${p.id}`).toBe(false)
      }
    // inside the exterior
    for (const p of divs) {
      expect(Math.min(...lo(p))).toBeGreaterThanOrEqual(T - 1e-6)
      expect(hi(p)[0]).toBeLessThanOrEqual(dims.w - T + 1e-6)
      expect(hi(p)[1]).toBeLessThanOrEqual(dims.h - T + 1e-6)
      expect(hi(p)[2]).toBeLessThanOrEqual(dims.d - T + 1e-6)
    }
  })

  it("dividers do not change the carcass or the bounds", () => {
    const plain = buildBox(inputs())
    const withDiv = buildBox(inputs({ dividers: 3 }))
    expect(withDiv.bounds).toEqual(plain.bounds)
    expect(withDiv.parts.filter((p) => p.type !== "divider")).toEqual(plain.parts)
    expect(withDiv.parts).toHaveLength(plain.parts.length + 3)
  })

  it("dividers == 0 adds none", () => {
    expect(buildBox(inputs()).parts.some((p) => p.type === "divider")).toBe(false)
  })

  it("works with the lap bottom", () => {
    for (const lidPosition of LIDS) {
      const r = buildBox(inputs({ lidPosition, bottomStyle: "lap", dividers: 2 }))
      expect(r.ok).toBe(true)
      const parts = r.parts
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++)
          expect(overlaps(parts[i], parts[j]), `${parts[i].id} vs ${parts[j].id}`).toBe(false)
    }
  })

  it("is deterministic", () => {
    const i = inputs({ dividers: 3, lidType: "split" })
    expect(buildBox(i)).toEqual(buildBox(structuredClone(i)))
  })
})

describe("validateDividers / no room", () => {
  const ib = interiorOf(EXT)

  it("returns [] for zero or fewer", () => {
    expect(validateDividers(0, ib, "top", "full", T)).toEqual([])
    expect(validateDividers(-1, ib, "top", "full", T)).toEqual([])
  })

  it("returns [] when there is room", () => {
    expect(validateDividers(3, ib, "top", "full", T)).toEqual([])
  })

  it("returns dividers-no-room when the gap is below the minimum", () => {
    // axis length 100 mm, one divider of 18: gap 41 -> ok; make the box narrow
    const narrow = interiorOf({ w: 2 * T + 60, d: 400, h: 300 })
    
    const issues = validateDividers(3, narrow, "top", "split", T) // divider axis x = 60
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe("dividers-no-room")
    expect(issues[0].field).toBe("dividers")
  })

  it("gap exactly at the minimum is allowed, just below is not", () => {
    const n = 2
    const span = (n + 1) * MIN_DIVIDER_GAP_MM + n * T
    const mk = (s: number) => interiorOf({ w: s + 2 * T, d: 1000, h: 1000 })
    // split lid: divider axis is x
    expect(validateDividers(n, mk(span), "top", "split", T)).toEqual([])
    expect(validateDividers(n, mk(span - 0.01), "top", "split", T)[0]?.code).toBe("dividers-no-room")
  })

  it("buildBox fails with ok:false, the code and no parts", () => {
    const r = buildBox(inputs({ dims: { w: 2 * T + 60, d: 400, h: 300 }, lidType: "split", hingeSide: "long", dividers: 3 }))
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain("dividers-no-room")
    expect(r.parts).toEqual([])
  })

  it("more dividers than fit fails while fewer succeed", () => {
    const dims = { w: 2 * T + 100, d: 400, h: 300 }
    const base = { dims, lidType: "split", hingeSide: "long" } as const
    expect(buildBox(inputs({ ...base, dividers: 1 })).ok).toBe(true)
    expect(buildBox(inputs({ ...base, dividers: 3 })).ok).toBe(false)
  })
})

describe("suggestDivider", () => {
  const s = (n: number, ib: Box, lid: LidPosition, type: LidType) =>
    suggestDivider(n, ib, lid, type, T, SPAN_SUGGEST_RATIO)
  const ib = interiorOf(EXT)

  it("is null whenever dividers already exist", () => {
    for (const type of TYPES) expect(s(1, ib, "top", type)).toBeNull()
    expect(s(3, ib, "front", "split")).toBeNull()
  })

  it("is 'seam' for split and half lids", () => {
    for (const lid of LIDS)
      for (const type of ["split", "half"] as const) expect(s(0, ib, lid, type)).toBe("seam")
  })

  it("full lid: 'span' when the longer lid-plane span exceeds ratio * t", () => {
    const limit = SPAN_SUGGEST_RATIO * T
    expect(s(0, JOINERY.butt.interiorBox({ w: limit + 1 + 2 * T, d: 100, h: 100 }, T), "top", "full")).toBe("span")
    expect(s(0, JOINERY.butt.interiorBox({ w: limit + 2 * T, d: 100, h: 100 }, T), "top", "full")).toBeNull()
    expect(s(0, JOINERY.butt.interiorBox({ w: limit - 1 + 2 * T, d: 100, h: 100 }, T), "top", "full")).toBeNull()
  })

  it("full lid considers only the lid-plane axes", () => {
    // huge height, small footprint: not suggested for a top lid (x,z only) ...
    const tall = interiorOf({ w: 200, d: 200, h: 2000 })
    expect(s(0, tall, "top", "full")).toBeNull()
    // ... but a front lid sees y
    expect(s(0, tall, "front", "full")).toBe("span")
    // huge depth: front lid (x,y) ignores z
    const deep = interiorOf({ w: 200, d: 2000, h: 200 })
    expect(s(0, deep, "front", "full")).toBeNull()
    expect(s(0, deep, "top", "full")).toBe("span")
  })

  it("default 18x12x10in 18 mm box: 364 mm span is below 540 mm, so no suggestion", () => {
    expect(s(0, ib, "top", "full")).toBeNull()
  })
})
