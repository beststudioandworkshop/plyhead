import { describe, it, expect } from "vitest"
import { buildBox, legFaceOptions, LEG_FACES } from "./index"
import type { BoxInputs } from "./types"
import { inToMm } from "./units"

const inputs = (overrides: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18,
  lidPosition: "top",
  lidType: "full",
  openLeaf: "right",
  legs: { face: null, height: 100, section: 38, inset: 12 },
  joinery: "butt",
  ...overrides,
})
import type { Face, LidPosition, Part, Vec3 } from "./types"

const W = inToMm(18)
const D = inToMm(12)
const H = inToMm(10)
const EXT: Vec3 = [W, H, D]

const lo = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] - p.extents[a] / 2) as Vec3
const hi = (p: Part): Vec3 => [0, 1, 2].map((a) => p.center[a] + p.extents[a] / 2) as Vec3
const legs = (face: Face | null, over: Partial<{ height: number; section: number; inset: number }> = {}) => ({
  face,
  height: 100,
  section: 38,
  inset: 12,
  ...over,
})
const NORMAL: Record<Face, { axis: 0 | 1 | 2; sign: 1 | -1 }> = {
  top: { axis: 1, sign: 1 },
  bottom: { axis: 1, sign: -1 },
  front: { axis: 2, sign: 1 },
  back: { axis: 2, sign: -1 },
  right: { axis: 0, sign: 1 },
  left: { axis: 0, sign: -1 },
}
const FACES: Face[] = ["top", "bottom", "front", "back", "left", "right"]

describe("legFaceOptions", () => {
  it.each(["top", "front"] as LidPosition[])("%s lid disables only that face", (lid) => {
    const opts = legFaceOptions(lid)
    expect(opts).toHaveLength(6)
    expect(opts.map((o) => o.face).sort()).toEqual([...FACES].sort())
    expect(LEG_FACES.slice().sort()).toEqual([...FACES].sort())
    const disabled = opts.filter((o) => !o.enabled)
    expect(disabled.map((o) => o.face)).toEqual([lid])
    expect(disabled[0].reason).toBeTruthy()
    expect(opts.filter((o) => o.enabled)).toHaveLength(5)
  })
})

describe("leg validation", () => {
  it.each(["top", "front"] as LidPosition[])("legs on the %s (lid) face -> legs-on-lid-face", (lid) => {
    const r = buildBox(inputs({ lidPosition: lid, legs: legs(lid) }))
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(["legs-on-lid-face"])
    expect(r.parts).toEqual([])
  })

  it("invalid sizes -> legs-invalid-size", () => {
    for (const over of [
      { section: 0 },
      { section: -5 },
      { height: 0 },
      { height: -1 },
      { height: NaN },
      { section: NaN },
      { inset: -1 },
      { inset: NaN },
      { inset: Infinity },
    ]) {
      const r = buildBox(inputs({ legs: legs("bottom", over) }))
      expect(r.ok, JSON.stringify(over)).toBe(false)
      expect(r.issues.map((i) => i.code)).toEqual(["legs-invalid-size"])
      expect(r.parts).toEqual([])
    }
  })

  it("zero inset is valid", () => {
    expect(buildBox(inputs({ legs: legs("bottom", { inset: 0 }) })).ok).toBe(true)
  })

  it("legs too large for face -> legs-too-large-for-face", () => {
    // bottom face is W x D; D/2 = 152.4
    const r = buildBox(inputs({ legs: legs("bottom", { section: 145, inset: 12 }) }))
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(["legs-too-large-for-face"])
    expect(r.parts).toEqual([])
    expect(r.exterior).toEqual({ w: W, d: D, h: H })
    // left face is D x H; H/2 = 127
    expect(buildBox(inputs({ legs: legs("left", { section: 120, inset: 10 }) })).issues[0].code).toBe(
      "legs-too-large-for-face",
    )
    // exactly half is allowed (legs touch)
    expect(buildBox(inputs({ legs: legs("bottom", { section: D / 2 - 12, inset: 12 }) })).ok).toBe(true)
  })

  it("face null -> no legs", () => {
    const r = buildBox(inputs({ legs: legs(null) }))
    expect(r.ok).toBe(true)
    expect(r.parts.some((p) => p.type === "leg")).toBe(false)
  })

  it("invalid leg sizes are ignored when there are no legs", () => {
    expect(buildBox(inputs({ legs: legs(null, { section: -1 }) })).ok).toBe(true)
  })
})

const cases: [LidPosition, Face][] = []
for (const lid of ["top", "front"] as const) for (const f of FACES) if (f !== lid) cases.push([lid, f])

describe("leg geometry", () => {
  it.each(cases)("%s lid, legs on %s", (lid, face) => {
    const height = 100
    const section = 38
    const inset = 12
    const r = buildBox(inputs({ lidPosition: lid, legs: legs(face, { height, section, inset }) }))
    expect(r.ok).toBe(true)
    const lg = r.parts.filter((p) => p.type === "leg")
    expect(lg).toHaveLength(4)
    for (const p of lg) {
      expect(p.name).toBe("Leg")
      expect(p.length).toBeCloseTo(height, 6)
      expect(p.width).toBeCloseTo(section, 6)
      expect(p.thickness).toBeCloseTo(section, 6)
      expect(p.grain).toBeNull()
    }

    const { axis, sign } = NORMAL[face]
    const inPlane = [0, 1, 2].filter((a) => a !== axis)
    for (const p of lg) {
      expect(p.extents[axis]).toBeCloseTo(height, 6)
      if (sign === 1) {
        expect(lo(p)[axis]).toBeCloseTo(EXT[axis], 6)
        expect(hi(p)[axis]).toBeCloseTo(EXT[axis] + height, 6)
      } else {
        expect(lo(p)[axis]).toBeCloseTo(-height, 6)
        expect(hi(p)[axis]).toBeCloseTo(0, 6)
      }
      for (const a of inPlane) {
        expect(p.extents[a]).toBeCloseTo(section, 6)
        const l = lo(p)[a]
        const ok =
          Math.abs(l - inset) < 1e-6 || Math.abs(l - (EXT[a] - inset - section)) < 1e-6
        expect(ok, `axis ${a} low ${l}`).toBe(true)
      }
    }

    // four distinct corners, covering every low/high combo
    const [a, b] = inPlane
    const keys = new Set(
      lg.map((p) => `${Math.abs(lo(p)[a] - inset) < 1e-6 ? "L" : "H"}${Math.abs(lo(p)[b] - inset) < 1e-6 ? "L" : "H"}`),
    )
    expect(keys.size).toBe(4)

    // symmetric about the face centre
    const c = lg.reduce((s, p) => [s[0] + p.center[a], s[1] + p.center[b]], [0, 0])
    expect(c[0] / 4).toBeCloseTo(EXT[a] / 2, 6)
    expect(c[1] / 4).toBeCloseTo(EXT[b] / 2, 6)
    for (const p of lg) {
      const mirror = lg.find(
        (q) =>
          Math.abs(q.center[a] - (EXT[a] - p.center[a])) < 1e-6 &&
          Math.abs(q.center[b] - (EXT[b] - p.center[b])) < 1e-6,
      )
      expect(mirror).toBeDefined()
    }

    // bounds include legs
    for (let i = 0; i < 3; i++) {
      if (i === axis) {
        if (sign === 1) {
          expect(r.bounds.min[i]).toBeCloseTo(0, 6)
          expect(r.bounds.max[i]).toBeCloseTo(EXT[i] + height, 2)
        } else {
          expect(r.bounds.min[i]).toBeCloseTo(-height, 2)
          expect(r.bounds.max[i]).toBeCloseTo(EXT[i], 2)
        }
      } else {
        expect(r.bounds.min[i]).toBeCloseTo(0, 6)
        expect(r.bounds.max[i]).toBeCloseTo(EXT[i], 2)
      }
    }

    // legs don't overlap the carcass volume
    for (const p of lg)
      for (const q of r.parts.filter((x) => x.type !== "leg"))
        expect([0, 1, 2].every((i) => Math.min(hi(p)[i], hi(q)[i]) - Math.max(lo(p)[i], lo(q)[i]) > 1e-4)).toBe(false)
  })

  it("bottom legs: y from -height to 0", () => {
    const r = buildBox(inputs({ legs: legs("bottom") }))
    for (const p of r.parts.filter((x) => x.type === "leg")) {
      expect(lo(p)[1]).toBeCloseTo(-100, 6)
      expect(hi(p)[1]).toBeCloseTo(0, 6)
    }
    expect(r.bounds.min[1]).toBeCloseTo(-100, 6)
  })

  it("leg ids are unique", () => {
    const r = buildBox(inputs({ legs: legs("bottom") }))
    const ids = r.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("legs do not change exterior/interior", () => {
    const a = buildBox(inputs())
    const b = buildBox(inputs({ legs: legs("bottom") }))
    expect(b.exterior).toEqual(a.exterior)
    expect(b.interior).toEqual(a.interior)
  })
})
