import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import {
  DROP_DOWN_ANGLE,
  OPEN_ANGLE,
  OPEN_STAGGER,
  openProgress,
  openSpecs,
  rotateAbout,
} from "./open"
import type { BoxInputs, HingeSide, LeafSide, LidPosition, LidType, Part, Vec3 } from "./types"
import { inToMm } from "./units"

const inputs = (overrides: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: inToMm(0.71),
  lidPosition: "top",
  lidType: "full",
  hingeSide: "long",
  openLeaf: "first",
  legs: { style: "none", height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  bottomStyle: "inset",
  dividers: 0,
  joinery: "butt",
  ...overrides,
})

const POSITIONS: LidPosition[] = ["top", "front"]
const TYPES: LidType[] = ["full", "split", "half"]
const SIDES: HingeSide[] = ["long", "short"]
const LEAVES: LeafSide[] = ["first", "second"]

interface Case {
  label: string
  position: LidPosition
  type: LidType
  side: HingeSide
  leaf: LeafSide
  overrides: Partial<BoxInputs>
}

const cases: Case[] = []
for (const position of POSITIONS)
  for (const type of TYPES)
    for (const side of SIDES)
      for (const leaf of LEAVES)
        cases.push({
          label: `${position}/${type}/${side}/${leaf}`,
          position,
          type,
          side,
          leaf,
          overrides: { lidPosition: position, lidType: type, hingeSide: side, openLeaf: leaf },
        })
// Square lid: hinge direction is ambiguous between long and short.
for (const position of POSITIONS)
  for (const type of TYPES)
    for (const side of SIDES)
      cases.push({
        label: `square ${position}/${type}/${side}/first`,
        position,
        type,
        side,
        leaf: "first",
        overrides: {
          dims: { w: inToMm(12), d: inToMm(12), h: inToMm(10) },
          lidPosition: position,
          lidType: type,
          hingeSide: side,
          openLeaf: "first",
        },
      })

const partsOf = (c: Case): Part[] => {
  const r = buildBox(inputs(c.overrides))
  expect(r.ok).toBe(true)
  return r.parts
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const normalOf = (p: LidPosition): Vec3 => (p === "top" ? [0, 1, 0] : [0, 0, 1])
const closeVec = (a: Vec3, b: Vec3, digits = 9) => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], digits)
}

describe("openSpecs", () => {
  describe.each(cases)("$label", (c) => {
    const parts = partsOf(c)
    const specs = openSpecs(parts, c.position)
    const hinged = parts.filter((p) => p.type === "lid" && p.hinge)

    it("keys match the hinged lid parts", () => {
      expect([...specs.keys()].sort()).toEqual(hinged.map((p) => p.id).sort())
      const expected = c.type === "split" ? 2 : 1
      expect(hinged.length).toBe(expected)
      expect(specs.size).toBe(expected)
      // Parts without a hinge never get a spec.
      for (const p of parts) {
        if (!(p.type === "lid" && p.hinge)) expect(specs.has(p.id)).toBe(false)
      }
    })

    it("counts leaves and ranks them in parts order", () => {
      const ids = hinged.map((p) => p.id)
      ids.forEach((id, i) => {
        const s = specs.get(id)!
        expect(s.leaves).toBe(hinged.length)
        expect(s.rank).toBe(i)
      })
    })

    it("has a unit axis parallel to the hinge and pivots at hinge.from", () => {
      for (const p of hinged) {
        const s = specs.get(p.id)!
        const h = p.hinge!
        expect(len(s.axis)).toBeCloseTo(1, 12)
        const dir = sub(h.to, h.from)
        const L = len(dir)
        expect(L).toBeGreaterThan(0)
        // Parallel and same direction as the hinge line.
        expect(dot(s.axis, dir) / L).toBeCloseTo(1, 12)
        expect(s.pivot).toEqual(h.from)
      }
    })

    it("swings the leaf up and out of the box", () => {
      const n = normalOf(c.position)
      for (const p of hinged) {
        const s = specs.get(p.id)!
        const rel = sub(p.center, s.pivot)
        const rotated = rotateAbout(rel, s.axis, s.angle)
        expect(dot(rotated, n)).toBeGreaterThan(0)
        expect(dot(rotated, n)).toBeGreaterThan(dot(rel, n))
        // Fully open: the centre ends up on the outward side of the pivot.
        const open = rotateAbout(sub(p.center, s.pivot), s.axis, s.angle)
        expect(dot(open, n)).toBeGreaterThan(0)
      }
    })

    it("uses the right angle magnitude per hinge edge", () => {
      for (const p of hinged) {
        const s = specs.get(p.id)!
        const expected = p.hinge!.edge === "bottom" ? DROP_DOWN_ANGLE : OPEN_ANGLE
        expect(Math.abs(s.angle)).toBeCloseTo(expected, 12)
      }
    })

    it("is deterministic and leaves its input untouched", () => {
      const before = structuredClone(parts)
      const a = openSpecs(parts, c.position)
      const b = openSpecs(parts, c.position)
      expect(parts).toEqual(before)
      expect([...a.entries()]).toEqual([...b.entries()])
      expect([...a.entries()]).toEqual([...specs.entries()])
    })
  })

  it("only the opening half of a half lid is present", () => {
    for (const leaf of LEAVES) {
      const parts = buildBox(inputs({ lidType: "half", openLeaf: leaf })).parts
      const specs = openSpecs(parts, "top")
      expect([...specs.keys()]).toEqual([`lid-${leaf}`])
      expect(specs.get(`lid-${leaf}`)!.leaves).toBe(1)
      expect(specs.get(`lid-${leaf}`)!.rank).toBe(0)
    }
  })

  it("returns an empty map when there are no hinged lids", () => {
    const parts = buildBox(inputs()).parts.filter((p) => p.type !== "lid")
    expect(openSpecs(parts, "top").size).toBe(0)
    expect(openSpecs([], "front").size).toBe(0)
  })

  it("uses 90 degrees for a bottom-hinged edge and 100 otherwise across the sweep", () => {
    const edges = new Set<string>()
    for (const c of cases) {
      for (const p of partsOf(c)) {
        if (p.type === "lid" && p.hinge) edges.add(p.hinge.edge)
      }
    }
    expect(edges.size).toBeGreaterThan(0)
    expect(OPEN_ANGLE).toBeCloseTo((100 * Math.PI) / 180, 12)
    expect(DROP_DOWN_ANGLE).toBeCloseTo(Math.PI / 2, 12)
  })
})

describe("rotateAbout", () => {
  const axes: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1 / Math.SQRT2, 0, 1 / Math.SQRT2],
    [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
  ]
  const v: Vec3 = [3, -2, 5]
  const angles = [0.3, 1, Math.PI / 2, 1.745, -0.8, 4]

  it("preserves length and the component along the axis", () => {
    for (const axis of axes) {
      for (const a of angles) {
        const r = rotateAbout(v, axis, a)
        expect(len(r)).toBeCloseTo(len(v), 9)
        expect(dot(r, axis)).toBeCloseTo(dot(v, axis), 9)
      }
    }
  })

  it("preserves distance from the pivot for real leaves", () => {
    for (const c of cases) {
      const parts = partsOf(c)
      const specs = openSpecs(parts, c.position)
      for (const p of parts) {
        const s = specs.get(p.id)
        if (!s) continue
        const rel = sub(p.center, s.pivot)
        const r = rotateAbout(rel, s.axis, s.angle)
        expect(len(r)).toBeCloseTo(len(rel), 6)
        expect(dot(r, s.axis)).toBeCloseTo(dot(rel, s.axis), 6)
      }
    }
  })

  it("is the identity at angle 0", () => {
    for (const axis of axes) closeVec(rotateAbout(v, axis, 0), v)
  })

  it("returns to the start after a full turn", () => {
    for (const axis of axes) closeVec(rotateAbout(v, axis, 2 * Math.PI), v)
  })

  it("composes: two half turns return, two quarter turns equal a half turn", () => {
    for (const axis of axes) {
      closeVec(rotateAbout(rotateAbout(v, axis, Math.PI), axis, Math.PI), v)
      closeVec(
        rotateAbout(rotateAbout(v, axis, Math.PI / 2), axis, Math.PI / 2),
        rotateAbout(v, axis, Math.PI),
      )
      closeVec(rotateAbout(rotateAbout(v, axis, 0.7), axis, -0.7), v)
    }
  })

  it("follows the right-hand rule", () => {
    closeVec(rotateAbout([1, 0, 0], [0, 0, 1], Math.PI / 2), [0, 1, 0])
    closeVec(rotateAbout([0, 1, 0], [1, 0, 0], Math.PI / 2), [0, 0, 1])
    closeVec(rotateAbout([0, 0, 1], [0, 1, 0], Math.PI / 2), [1, 0, 0])
  })

  it("does not mutate its inputs", () => {
    const vv: Vec3 = [1, 2, 3]
    const aa: Vec3 = [0, 1, 0]
    rotateAbout(vv, aa, 1)
    expect(vv).toEqual([1, 2, 3])
    expect(aa).toEqual([0, 1, 0])
  })
})

describe("openProgress", () => {
  const configs: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ]
  const ts = Array.from({ length: 101 }, (_, i) => i / 100)

  it.each(configs)("is 0 at t=0 and 1 at t=1 (rank %i of %i)", (rank, leaves) => {
    expect(openProgress(0, rank, leaves)).toBe(0)
    expect(openProgress(1, rank, leaves)).toBe(1)
  })

  it.each(configs)("is monotonic and bounded (rank %i of %i)", (rank, leaves) => {
    let prev = -Infinity
    for (const t of ts) {
      const p = openProgress(t, rank, leaves)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })

  it("clamps outside [0, 1]", () => {
    for (const [rank, leaves] of configs) {
      expect(openProgress(-0.5, rank, leaves)).toBe(0)
      expect(openProgress(1.5, rank, leaves)).toBe(1)
    }
  })

  it("makes the second leaf lag the first when two leaves open", () => {
    for (const t of ts.filter((x) => x > 0 && x < 1)) {
      expect(openProgress(t, 1, 2)).toBeLessThan(openProgress(t, 0, 2))
    }
  })

  it("ignores rank when only one leaf opens", () => {
    for (const t of ts) {
      expect(openProgress(t, 1, 1)).toBe(openProgress(t, 0, 1))
    }
  })

  it("keeps the second leaf closed at the stagger point while the first has moved", () => {
    expect(OPEN_STAGGER).toBe(0.4)
    expect(openProgress(OPEN_STAGGER, 1, 2)).toBe(0)
    expect(openProgress(OPEN_STAGGER, 0, 2)).toBeGreaterThan(0)
  })

  it("is eased: midpoint of the first leaf's own span is 0.5", () => {
    expect(openProgress(0.5, 0, 1)).toBeCloseTo(0.5, 12)
    expect(openProgress((1 - OPEN_STAGGER) / 2 + OPEN_STAGGER, 1, 2)).toBeCloseTo(0.5, 12)
  })
})
