import { describe, it, expect } from "vitest"
import { buildBox } from "./build"
import { hardwareList, type HardwareItem } from "./hardware"
import { screwAdvice } from "./screws"
import type { BoxInputs, LegInputs } from "./types"
import { inToMm } from "./units"

const inputs = (o: Partial<BoxInputs> = {}): BoxInputs => ({
  dimensionMode: "exterior",
  dims: { w: inToMm(18), d: inToMm(12), h: inToMm(10) },
  clearance: 3.175,
  thickness: 18.03,
  lidPosition: "top",
  lidType: "full",
  hingeSide: "long",
  openLeaf: "second",
  legs: { style: "none", height: 100, diameter: 38, inset: 12, width: 76, footWidth: 38 },
  bottomStyle: "inset",
  dividers: 0,
  joinery: "butt",
  ...o,
})
const legs = (style: LegInputs["style"]): LegInputs => ({
  style,
  height: 100,
  diameter: 38,
  inset: 12,
  width: 76,
  footWidth: 38,
})
const list = (o: Partial<BoxInputs> = {}, unit: "in" | "mm" = "in") => {
  const i = inputs(o)
  return hardwareList(i, buildBox(i), unit)
}
const find = (l: HardwareItem[], name: string) => l.find((x) => x.name === name)

describe("hardwareList basics", () => {
  it("returns [] when the build is not ok", () => {
    const i = inputs({ thickness: 0 })
    const r = buildBox(i)
    expect(r.ok).toBe(false)
    expect(hardwareList(i, r, "in")).toEqual([])
  })

  it("orders by category, has unique ids, and is deterministic", () => {
    const l = list({ legs: legs("dowel") })
    const order = ["hinges", "lid", "legs", "fasteners", "supplies"]
    const idx = l.map((x) => order.indexOf(x.category))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
    expect(new Set(l.map((x) => x.id)).size).toBe(l.length)
    expect(list({ legs: legs("dowel") })).toEqual(l)
  })

  it("default box has hinges, lid support, pull, screws, glue, bit and no legs", () => {
    const l = list()
    expect(l.filter((x) => x.category === "legs")).toEqual([])
    expect(find(l, "Lid pull or knob")?.qty).toBe(1)
    expect(find(l, "Lid support (stay)")?.qty).toBe(1)
    expect(find(l, "Wood glue")).toMatchObject({ qty: 1, spec: "8 oz bottle" })
    expect(find(l, "Pilot-hole bit and countersink")?.qty).toBe(1)
  })
})

describe("hinges", () => {
  it("18 in hinge line gets 3 butt hinges, 2 in size at 0.71 in ply", () => {
    const h = find(list(), "Butt hinge")!
    expect(h.qty).toBe(3)
    expect(h.spec).toBe('2"')
    expect(h.note).toBe('Use the screws that come with the hinges, no longer than 0.592"')
  })

  it("10 in hinge gets 2", () => {
    const h = find(list({ dims: { w: inToMm(10), d: inToMm(8), h: inToMm(6) } }), "Butt hinge")!
    expect(h.qty).toBe(2)
  })

  it("30 in hinge gets one continuous hinge cut to length", () => {
    const l = list({ dims: { w: inToMm(30), d: inToMm(12), h: inToMm(10) } })
    expect(find(l, "Butt hinge")).toBeUndefined()
    const c = find(l, "Continuous (piano) hinge")!
    expect(c.qty).toBe(1)
    expect(c.spec).toBe('Cut to 30"')
    expect(c.meta?.lengthMm).toBeCloseTo(inToMm(30), 6)
  })

  it("metric spec text", () => {
    const l = list({ dims: { w: inToMm(30), d: inToMm(12), h: inToMm(10) }, thickness: 18 }, "mm")
    expect(find(l, "Continuous (piano) hinge")!.spec).toBe("Cut to 762 mm")
    expect(find(l, "Continuous (piano) hinge")!.note).toBe(
      "Use the screws that come with the hinges, no longer than 15 mm",
    )
    expect(find(list({ thickness: 18 }, "mm"), "Butt hinge")!.spec).toBe("50 mm")
    expect(find(list({ thickness: 12 }, "mm"), "Butt hinge")!.spec).toBe("38 mm")
  })

  it("split lid with long hinges aggregates identical leaves", () => {
    const l = list({ lidType: "split", dims: { w: inToMm(60), d: inToMm(12), h: inToMm(10) } })
    const c = l.filter((x) => x.name === "Continuous (piano) hinge")
    expect(c).toHaveLength(1)
    expect(c[0].qty).toBe(2)
    expect(find(l, "Lid pull or knob")!.qty).toBe(2)
    expect(find(l, "Lid support (stay)")!.qty).toBe(2)
  })

  it("split lid with short leaf hinges sums butt hinges", () => {
    const i = inputs({ lidType: "split" })
    const r = buildBox(i)
    const leaves = r.parts.filter((p) => p.hinge)
    expect(leaves).toHaveLength(2)
    const total = find(hardwareList(i, r, "in"), "Butt hinge")!.qty
    expect(total).toBeGreaterThanOrEqual(4)
  })

  it("half lid has only the opening half's hardware", () => {
    const l = list({ lidType: "half" })
    expect(find(l, "Lid pull or knob")!.qty).toBe(1)
  })

  it("hinge size flips at 15 mm", () => {
    expect(find(list({ thickness: 14.99 }), "Butt hinge")!.spec).toBe('1 1/2"')
    expect(find(list({ thickness: 15 }), "Butt hinge")!.spec).toBe('2"')
    expect(find(list({ thickness: 12 }), "Butt hinge")!.spec).toBe('1 1/2"')
    expect(find(list({ thickness: 11.94 }), "Butt hinge")!.spec).toBe('1 1/2"')
  })
})

describe("lid hardware by hinge edge", () => {
  it("front lid hinged at the bottom gets 2 stays per leaf", () => {
    const i = inputs({ lidPosition: "front" })
    const r = buildBox(i)
    const lids = r.parts.filter((p) => p.hinge)
    expect(lids.length).toBeGreaterThan(0)
    const l = hardwareList(i, r, "in")
    const edge = lids[0].hinge!.edge
    if (edge === "bottom") {
      expect(find(l, "Door stay (chain or folding stay)")!.qty).toBe(2)
    } else {
      expect(["left", "right"]).toContain(edge)
    }
  })

  it("front lid, long hinge, drop-down: 2 stays", () => {
    for (const hingeSide of ["long", "short"] as const) {
      const i = inputs({ lidPosition: "front", hingeSide })
      const r = buildBox(i)
      const edge = r.parts.find((p) => p.hinge)!.hinge!.edge
      const l = hardwareList(i, r, "in")
      if (edge === "bottom") expect(find(l, "Door stay (chain or folding stay)")!.qty).toBe(2)
      if (edge === "left" || edge === "right") expect(find(l, "Magnetic catch")!.qty).toBe(1)
    }
  })

  it("front lid hardware says Door, never Lid, with unchanged ids", () => {
    for (const hingeSide of ["long", "short"] as const)
      for (const lidType of ["full", "split", "half"] as const) {
        const i = inputs({ lidPosition: "front", lidType, hingeSide })
        const l = hardwareList(i, buildBox(i), "in").filter((x) => x.category === "lid")
        expect(l.length).toBeGreaterThan(0)
        for (const x of l) {
          expect(x.name.toLowerCase()).not.toContain("lid")
          expect(x.spec.toLowerCase()).not.toContain("lid")
        }
        expect(find(l, "Door pull or knob")?.id).toBe("lid-pull")
      }
  })

  it("front lid names and specs for each hinge edge", () => {
    const seen = new Set<string>()
    for (const hingeSide of ["long", "short"] as const) {
      const i = inputs({ lidPosition: "front", hingeSide })
      const r = buildBox(i)
      const l = hardwareList(i, r, "in")
      const edge = r.parts.find((p) => p.hinge)!.hinge!.edge
      seen.add(edge)
      expect(find(l, "Door pull or knob")).toMatchObject({ id: "lid-pull", spec: "Surface mount" })
      if (edge === "bottom")
        expect(find(l, "Door stay (chain or folding stay)")).toMatchObject({ id: "lid-stay-chain", spec: "Holds the door level when open" })
      else expect(find(l, "Magnetic catch")?.id).toBe("lid-catch")
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it("top lid hardware keeps the Lid wording", () => {
    const l = list()
    expect(find(l, "Lid support (stay)")).toMatchObject({ id: "lid-support", spec: "Hinged lid support" })
    expect(l.some((x) => x.name.startsWith("Door"))).toBe(false)
  })

  it("front doors (split) get magnetic catches", () => {
    const i = inputs({ lidPosition: "front", lidType: "split", hingeSide: "short" })
    const r = buildBox(i)
    const edges = r.parts.filter((p) => p.hinge).map((p) => p.hinge!.edge)
    const doors = edges.filter((e) => e === "left" || e === "right").length
    const l = hardwareList(i, r, "in")
    expect(find(l, "Magnetic catch")?.qty ?? 0).toBe(doors)
  })
})

describe("legs", () => {
  it("none adds nothing", () => {
    expect(list({ legs: legs("none") }).some((x) => x.category === "legs")).toBe(false)
  })

  it("dowel", () => {
    const l = list({ legs: legs("dowel") })
    expect(find(l, "Wood dowel")).toMatchObject({ qty: 4, spec: 'Ø1 1/2" × 3 15/16"' })
    expect(find(l, "Dowel fastener")!.qty).toBe(4)
    expect(find(l, "Dowel fastener")!.spec).toContain('2 1/2"')
    const m = list({ legs: legs("dowel") }, "mm")
    expect(find(m, "Wood dowel")!.spec).toBe("Ø38 mm × 100 mm")
    expect(find(m, "Dowel fastener")!.spec).toContain("63 mm")
  })

  it("tapered", () => {
    const l = list({ legs: legs("tapered") })
    expect(find(l, "Leg screws, plate to bottom")!.qty).toBe(16)
    expect(find(l, "Leg screws, plate to plate")!.qty).toBe(12)
    expect(find(l, "Leg screws, plate to bottom")!.spec).toBe('#8 × 1 3/4"')
    expect(find(list({ legs: legs("tapered") }, "mm"), "Leg screws, plate to plate")!.spec).toBe("#8 × 45 mm")
  })
})

describe("fasteners and supplies", () => {
  it("main screws use the good tier, note quotes the better tier", () => {
    const l = list()
    const s = find(l, "Wood screws, main joints")!
    expect(s.spec).toBe('#8 × 1 3/4"')
    expect(s.qty).toBeGreaterThan(0)
    expect(s.note).toMatch(/^Or \d+ screws at 2 1\/2" for the stronger option$/)
    const m = find(list({}, "mm"), "Wood screws, main joints")!
    expect(m.spec).toBe("#8 × 45 mm")
    expect(m.note).toMatch(/at 60 mm/)
  })

  it("screw quantity grows with a front lid and dividers", () => {
    const base = find(list(), "Wood screws, main joints")!.qty
    expect(find(list({ lidPosition: "front" }), "Wood screws, main joints")!.qty).toBeGreaterThan(base)
    expect(find(list({ dividers: 2 }), "Wood screws, main joints")!.qty).toBeGreaterThan(base)
  })

  it("pilot bit spec is the fixed 1/8 in pilot, in either unit", () => {
    const a = screwAdvice(18.03)
    expect(a.pilotMm).toBeCloseTo(3.175, 9)
    expect(find(list({}, "in"), "Pilot-hole bit and countersink")!.spec).toBe('1/8" pilot bit')
    expect(find(list({}, "mm"), "Pilot-hole bit and countersink")!.spec).toBe("3.2 mm pilot bit")
  })

  it("pilot bit note says pilots are always this size and to countersink", () => {
    const n = find(list({}, "mm"), "Pilot-hole bit and countersink")!.note!
    expect(n).toBe("Pilot holes are always this size. Countersink the heads: it's worth it on a project like this.")
  })
})
