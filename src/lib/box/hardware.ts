import { MM_PER_INCH } from "./constants"
import { estimateJointLength, screwAdvice, screwCount, type ScrewTierAdvice } from "./screws"
import type { BoxInputs, BoxResult, Part, Unit } from "./types"
import { formatLength, formatThickness } from "./units"

/**
 * Hardware list for a box: hinges, lid hardware, legs, screws and supplies.
 * Pure, framework-free. Rules of thumb, not engineering.
 */

export type HardwareCategory = "hinges" | "lid" | "legs" | "fasteners" | "supplies"

export interface HardwareItem {
  id: string
  category: HardwareCategory
  name: string
  spec: string
  qty: number
  note?: string
  /** Continuous hinges only: the cut length (mm), so pricing can work by length. */
  meta?: { lengthMm?: number }
}

const CATEGORY_ORDER: HardwareCategory[] = ["hinges", "lid", "legs", "fasteners", "supplies"]

/** Hinge line length (mm) up to which a leaf gets 2 / 3 butt hinges. */
const TWO_HINGE_MAX_MM = 300
const THREE_HINGE_MAX_MM = 600
/** Plywood at or above this thickness gets the bigger butt hinge. */
const BIG_HINGE_MIN_THICKNESS_MM = 15

const hingeLength = (p: Part) => {
  const h = p.hinge!
  return Math.hypot(h.to[0] - h.from[0], h.to[1] - h.from[1], h.to[2] - h.from[2])
}

/** Stock screw length for a tier, in the display unit: `1 3/4"` or `45 mm`. */
const stockLength = (tier: ScrewTierAdvice, unit: Unit) =>
  unit === "in" ? formatLength(tier.lengthIn * MM_PER_INCH, "in") : formatLength(tier.lengthMetricMm, "mm")

export function hardwareList(inputs: BoxInputs, result: BoxResult, unit: Unit): HardwareItem[] {
  if (!result.ok) return []
  const t = inputs.thickness
  const items: HardwareItem[] = []
  const add = (item: HardwareItem) => {
    const existing = items.find((i) => i.id === item.id)
    if (existing) existing.qty += item.qty
    else items.push(item)
  }

  // Hinges
  const hingeNote = `Use the screws that come with the hinges, no longer than ${formatThickness(t - 3, unit)}`
  const big = t >= BIG_HINGE_MIN_THICKNESS_MM
  const hingedParts = result.parts.filter((p) => p.hinge)
  for (const p of hingedParts) {
    const len = hingeLength(p)
    if (len > THREE_HINGE_MAX_MM) {
      const rounded = Math.round(len * 100) / 100
      add({
        id: `hinge-continuous-${rounded}`,
        category: "hinges",
        name: "Continuous (piano) hinge",
        spec: `Cut to ${formatLength(len, unit)}`,
        qty: 1,
        note: hingeNote,
        meta: { lengthMm: len },
      })
    } else {
      const qty = len <= TWO_HINGE_MAX_MM ? 2 : 3
      const sizeMm = big ? (unit === "in" ? 2 * MM_PER_INCH : 50) : unit === "in" ? 1.5 * MM_PER_INCH : 38
      add({
        id: big ? "hinge-butt-2in" : "hinge-butt-1.5in",
        category: "hinges",
        name: "Butt hinge",
        spec: formatLength(sizeMm, unit),
        qty,
        note: hingeNote,
      })
    }
  }

  // Lid hardware
  for (const p of hingedParts) {
    if (p.type !== "lid") continue
    add({ id: "lid-pull", category: "lid", name: "Lid pull or knob", spec: "Surface mount", qty: 1 })
    switch (p.hinge!.edge) {
      case "back":
        add({ id: "lid-support", category: "lid", name: "Lid support (stay)", spec: "Hinged lid support", qty: 1 })
        break
      case "bottom":
        add({
          id: "lid-stay-chain",
          category: "lid",
          name: "Lid stay (chain or folding stay)",
          spec: "Holds the lid level when open",
          qty: 2,
        })
        break
      case "left":
      case "right":
        add({ id: "lid-catch", category: "lid", name: "Magnetic catch", spec: "Surface mount", qty: 1 })
        break
      default:
        add({ id: "lid-stay", category: "lid", name: "Lid stay", spec: "Holds the lid open", qty: 2 })
    }
  }

  const adv = screwAdvice(t)

  // Legs
  const legs = inputs.legs
  if (legs.style === "dowel") {
    add({
      id: "leg-dowel",
      category: "legs",
      name: "Wood dowel",
      spec: `Ø${formatLength(legs.diameter, unit)} × ${formatLength(legs.height, unit)}`,
      qty: 4,
    })
    add({
      id: "leg-dowel-fastener",
      category: "legs",
      name: "Dowel fastener",
      spec: `Hanger bolt or a #10 screw, at least ${formatLength(unit === "in" ? 2.5 * MM_PER_INCH : 63, unit)}`,
      qty: 4,
    })
  } else if (legs.style === "tapered") {
    const size = `${adv.gauge} × ${stockLength(adv.good, unit)}`
    add({ id: "leg-screws-plate-bottom", category: "legs", name: "Leg screws, plate to bottom", spec: size, qty: 16 })
    add({ id: "leg-screws-plate-plate", category: "legs", name: "Leg screws, plate to plate", spec: size, qty: 12 })
  }

  // Fasteners
  const joint = estimateJointLength(result.exterior, inputs.lidPosition, inputs.dividers)
  const goodQty = screwCount(joint, adv.good.spacingMm)
  const betterQty = screwCount(joint, adv.better.spacingMm)
  add({
    id: "screws-main",
    category: "fasteners",
    name: "Wood screws, main joints",
    spec: `${adv.gauge} × ${stockLength(adv.good, unit)}`,
    qty: goodQty,
    note: `Or ${betterQty} screws at ${stockLength(adv.better, unit)} for the stronger option`,
  })

  // Supplies
  add({ id: "glue", category: "supplies", name: "Wood glue", spec: "8 oz bottle", qty: 1 })
  add({
    id: "pilot-bit",
    category: "supplies",
    name: "Pilot-hole bit and countersink",
    spec: adv.gauge,
    qty: 1,
    note: `Pilot ${formatThickness(adv.pilotMm, unit)} in the second panel, clearance ${formatThickness(adv.clearanceMm, unit)} in the first`,
  })

  return items.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
}
