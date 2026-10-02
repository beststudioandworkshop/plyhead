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
  if (lid === "front") return 1 // a door means horizontal shelves, whatever the lid type, hinge side or size
  const i = sizeOf(interiorOf(dims))
  if (type !== "full") return 0 // split/half top lids always divide across x, whatever the hinge side
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

  it("top lid tie between x and z goes to x", () => {
    expect(dividerAxis(interiorOf({ w: 300, d: 300, h: 200 }), "top", "full")).toBe(0)
  })

  it("front lid always uses y (horizontal shelves), whatever the type or box shape", () => {
    for (const dims of DIMS)
      for (const type of TYPES) expect(dividerAxis(interiorOf(dims), "front", type)).toBe(1)
    expect(dividerAxis(interiorOf({ w: 200, d: 300, h: 400 }), "front", "full")).toBe(1)
    expect(dividerAxis(interiorOf({ w: 300, d: 200, h: 300 }), "front", "full")).toBe(1)
    expect(dividerAxis(interiorOf({ w: 600, d: 200, h: 100 }), "front", "full")).toBe(1)
  })

  it("split/half top lids always use x, independent of the (non-existent) hinge side", () => {
    for (const dims of DIMS)
      for (const type of ["split", "half"] as const) expect(dividerAxis(interiorOf(dims), "top", type)).toBe(0)
    // including non-square boxes where z is the long lid edge
    expect(dividerAxis(interiorOf({ w: 200, d: 400, h: 300 }), "top", "split")).toBe(0)
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
  for (const d of DIMS) for (const l of LIDS) for (const t of TYPES) for (const h of SIDES) for (const n of [1, 2, 3]) if (l === "front" || t === "full" || n % 2 === 1) cases.push([d, l, t, h, n])

  it.each(cases)("%o %s %s %s x%i: names, placement and no overlaps", (dims, lidPosition, lidType, hingeSide, n) => {
    const r = buildBox(inputs({ dims, lidPosition, lidType, hingeSide, dividers: n }))
    expect(r.ok).toBe(true)
    const divs = r.parts.filter((p) => p.type === "divider")
    expect(divs.map((p) => p.id)).toEqual(Array.from({ length: n }, (_, i) => `divider-${i + 1}`))
    for (const p of divs) {
      expect(p.name).toBe(lidPosition === "front" ? "Shelf" : "Divider")
      expect(p.thickness).toBeCloseTo(T, 6)
      expect(p.shape).toBe("box")
    }

    const axis = expectedAxis(dims, lidPosition, lidType)
    if (lidPosition === "front") expect(axis).toBe(1)
    else if (lidType !== "full") expect(axis).toBe(0)
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
      if (lidPosition === "top" && lidType !== "full") {
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

  it("split/half top lids with an even divider count fail with dividers-need-seam", () => {
    const evenCases: [(typeof EXT), LidPosition, LidType, HingeSide][] = []
    for (const d of DIMS) for (const l of ["top"] as LidPosition[]) for (const t of ["split", "half"] as const) for (const h of SIDES) evenCases.push([d, l, t, h])
    for (const [dims, lidPosition, lidType, hingeSide] of evenCases) {
      const r = buildBox(inputs({ dims, lidPosition, lidType, hingeSide, dividers: 2 }))
      expect(r.ok).toBe(false)
      expect(r.issues.map((i) => i.code)).toEqual(["dividers-need-seam"])
      expect(r.parts).toEqual([])
    }
  })

  it("full lids with 2 dividers build and have none on the exact centre", () => {
    for (const dims of DIMS)
      for (const lidPosition of LIDS)
        for (const hingeSide of SIDES) {
          const r = buildBox(inputs({ dims, lidPosition, lidType: "full", hingeSide, dividers: 2 }))
          expect(r.ok).toBe(true)
          const divs = r.parts.filter((p) => p.type === "divider")
          expect(divs).toHaveLength(2)
          const axis = expectedAxis(dims, lidPosition, "full")
          const ib = interiorOf(dims)
          const mid = (ib.min[axis] + ib.max[axis]) / 2
          for (const p of divs) {
            expect(Math.abs(p.center[axis] - mid)).toBeGreaterThan(1)
            // neither divider straddles the centre either
            expect(lo(p)[axis] < mid && hi(p)[axis] > mid).toBe(false)
          }
          // symmetric about the centre
          expect(divs[0].center[axis] + divs[1].center[axis]).toBeCloseTo(2 * mid, 6)
        }
  })

  describe("split/half seam support", () => {
    const seamCases: [(typeof EXT), LidPosition, LidType, HingeSide, number][] = []
    for (const d of DIMS) for (const l of ["top"] as LidPosition[]) for (const t of ["split", "half"] as const) for (const h of SIDES) for (const n of [1, 3]) seamCases.push([d, l, t, h, n])

    it.each(seamCases)("%o %s %s %s x%i: one divider centred on the seam, others symmetric", (dims, lidPosition, lidType, hingeSide, n) => {
      const r = buildBox(inputs({ dims, lidPosition, lidType, hingeSide, dividers: n }))
      expect(r.ok).toBe(true)
      const divs = r.parts.filter((p) => p.type === "divider")
      expect(divs).toHaveLength(n)
      const seamX = dims.w / 2
      const centred = divs.filter((p) => Math.abs(p.center[0] - seamX) <= 1e-6)
      expect(centred).toHaveLength(1)
      if (n === 3) {
        const xs = divs.map((p) => p.center[0]).sort((a, b) => a - b)
        expect(xs[1]).toBeCloseTo(seamX, 6)
        expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 6)
        expect(xs[0] + xs[2]).toBeCloseTo(2 * seamX, 6)
        const [a, b, c] = [...divs].sort((p, q) => p.center[0] - q.center[0])
        const g1 = lo(b)[0] - hi(a)[0]
        const g2 = lo(c)[0] - hi(b)[0]
        expect(g1).toBeCloseTo(g2, 6)
        expect(g1).toBeGreaterThan(0)
      }
    })

    it.each(seamCases)("%o %s %s %s x%i: divider top face touches the lid underside", (dims, lidPosition, lidType, hingeSide, n) => {
      const r = buildBox(inputs({ dims, lidPosition, lidType, hingeSide, dividers: n }))
      expect(r.ok).toBe(true)
      const divs = r.parts.filter((p) => p.type === "divider")
      const seamDiv = divs.find((p) => Math.abs(p.center[0] - dims.w / 2) <= 1e-6)!
      const lids = r.parts.filter((p) => p.type === "lid")
      expect(lids.length).toBeGreaterThan(0)
      const a = lidPosition === "top" ? 1 : 2
      const limit = (lidPosition === "top" ? dims.h : dims.d) - T
      expect(hi(seamDiv)[a]).toBeCloseTo(limit, 6)
      // both leaves bear on it: their underside is at the same plane and they span the seam
      for (const lid of lids) {
        expect(lo(lid)[a]).toBeCloseTo(hi(seamDiv)[a], 6)
        const touchesX = lo(lid)[0] <= dims.w / 2 + 1e-6 && hi(lid)[0] >= dims.w / 2 - 1e-6
        expect(touchesX, lid.id).toBe(true)
      }
    })
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

describe("front-lid shelves", () => {
  const combos: [(typeof EXT), LidType, HingeSide, number][] = []
  for (const d of DIMS) for (const t of TYPES) for (const h of SIDES) for (const n of [0, 1, 2, 3]) combos.push([d, t, h, n])

  it.each(combos)("%o %s %s x%i: horizontal, evenly spaced, no overlaps", (dims, lidType, hingeSide, n) => {
    const r = buildBox(inputs({ dims, lidPosition: "front", lidType, hingeSide, dividers: n }))
    expect(r.ok).toBe(true)
    const shelves = r.parts.filter((p) => p.type === "divider")
    expect(shelves).toHaveLength(n)
    if (n === 0) return
    const ib = interiorOf(dims)
    const gap = (ib.max[1] - ib.min[1] - n * T) / (n + 1)
    shelves.forEach((p, i) => {
      expect(p.id).toBe(`divider-${i + 1}`)
      expect(p.name).toBe("Shelf")
      near(p.extents[1], T)
      near(lo(p)[0], ib.min[0])
      near(hi(p)[0], ib.max[0])
      near(lo(p)[2], ib.min[2])
      near(hi(p)[2], ib.max[2])
      near(p.center[1], ib.min[1] + (i + 1) * gap + i * T + T / 2)
    })
    // equal clear gaps between floor, shelves and the top
    near(lo(shelves[0])[1] - ib.min[1], gap)
    for (let i = 1; i < n; i++) near(lo(shelves[i])[1] - hi(shelves[i - 1])[1], gap)
    near(ib.max[1] - hi(shelves[n - 1])[1], gap)
    for (const d of shelves)
      for (const p of r.parts) {
        if (p === d) continue
        expect(overlaps(d, p), `${d.id} vs ${p.id}`).toBe(false)
      }
  })

  it("2 shelves are allowed with split and half doors", () => {
    for (const lidType of ["split", "half"] as const) {
      const r = buildBox(inputs({ lidPosition: "front", lidType, dividers: 2 }))
      expect(r.ok).toBe(true)
      expect(r.issues.map((i) => i.code)).not.toContain("dividers-need-seam")
      expect(r.parts.filter((p) => p.type === "divider")).toHaveLength(2)
    }
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
    const n = 3
    const span = (n + 1) * MIN_DIVIDER_GAP_MM + n * T
    const mk = (s: number) => interiorOf({ w: s + 2 * T, d: 1000, h: 1000 })
    // split lid: divider axis is x
    expect(validateDividers(n, mk(span), "top", "split", T)).toEqual([])
    expect(validateDividers(n, mk(span - 0.01), "top", "split", T)[0]?.code).toBe("dividers-no-room")
  })

  it.each((["split", "half"] as const).map((t) => ["top", t] as const))(
    "even counts on a %s %s lid give dividers-need-seam",
    (lid, type) => {
      for (const n of [2]) {
        const issues = validateDividers(n, ib, lid, type, T)
        expect(issues).toHaveLength(1)
        expect(issues[0].code).toBe("dividers-need-seam")
        expect(issues[0].field).toBe("dividers")
      }
      for (const n of [1, 3]) expect(validateDividers(n, ib, lid, type, T)).toEqual([])
    },
  )

  it("dividers-need-seam is checked before dividers-no-room", () => {
    const narrow = interiorOf({ w: 2 * T + 30, d: 400, h: 300 })
    for (const lid of ["top"] as LidPosition[])
      for (const type of ["split", "half"] as const) {
        expect(validateDividers(2, narrow, lid, type, T).map((i) => i.code)).toEqual(["dividers-need-seam"])
        expect(validateDividers(3, narrow, lid, type, T).map((i) => i.code)).toEqual(["dividers-no-room"])
      }
    const r = buildBox(inputs({ dims: { w: 2 * T + 30, d: 400, h: 300 }, lidType: "split", dividers: 2 }))
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(["dividers-need-seam"])
    expect(r.parts).toEqual([])
  })

  it("full lids accept any count 0..3 including 2", () => {
    for (const n of [0, 1, 2, 3]) expect(validateDividers(n, ib, "top", "full", T)).toEqual([])
  })

  it("front lids accept any count including 2, for every lid type", () => {
    for (const type of TYPES) for (const n of [0, 1, 2, 3]) expect(validateDividers(n, ib, "front", type, T)).toEqual([])
  })

  it("front lid no-room check runs on the y axis (interior height)", () => {
    const n = 3
    const span = (n + 1) * MIN_DIVIDER_GAP_MM + n * T
    // narrow x and z but plenty of height: fine
    const wide = interiorOf({ w: 2 * T + 20, d: 2 * T + 20, h: span + 2 * T })
    expect(validateDividers(n, wide, "front", "split", T)).toEqual([])
    // plenty of x and z but too short: no room
    const short = interiorOf({ w: 1000, d: 1000, h: span - 0.01 + 2 * T })
    expect(validateDividers(n, short, "front", "full", T).map((i) => i.code)).toEqual(["dividers-no-room"])
    const r = buildBox(inputs({ dims: { w: 1000, d: 1000, h: 2 * T + 40 }, lidPosition: "front", dividers: 3 }))
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain("dividers-no-room")
    expect(r.parts).toEqual([])
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
    for (const type of ["split", "half"] as const) expect(s(0, ib, "top", type)).toBe("seam")
  })

  it("is always null for front lids (shelves need no nudge)", () => {
    for (const type of TYPES) {
      expect(s(0, ib, "front", type)).toBeNull()
      expect(s(0, interiorOf({ w: 200, d: 200, h: 2000 }), "front", type)).toBeNull()
    }
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
    // ... and a front lid never gets a suggestion
    expect(s(0, tall, "front", "full")).toBeNull()
    const deep = interiorOf({ w: 200, d: 2000, h: 200 })
    expect(s(0, deep, "front", "full")).toBeNull()
    expect(s(0, deep, "top", "full")).toBe("span")
  })

  it("default 18x12x10in 18 mm box: 364 mm span is below 540 mm, so no suggestion", () => {
    expect(s(0, ib, "top", "full")).toBeNull()
  })
})
