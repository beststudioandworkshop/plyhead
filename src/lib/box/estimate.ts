import type { HardwareItem } from "./hardware"

/** Rough cost estimates for building it yourself or buying a cut kit. Pure; money is rounded to cents. */

export interface PriceBook {
  sheet: Record<"4x8" | "5x5", number>
  buttHingeEach: number
  continuousHingePerMeter: number
  lidStayEach: number
  lidSupportEach: number
  pullEach: number
  magneticCatchEach: number
  dowelEach: number
  legFastenerEach: number
  screwEach: number
  glue: number
  pilotBit: number
  finishAllowance: number
}

export interface KitRates {
  /** Cutting each sheet part to size. */
  perPartCut: number
  /** Mortises plus the domino itself, per domino. */
  perDomino: number
  /** One domino about this far apart along each joint (mm). */
  dominoSpacingMm: number
  /** Fewest dominos in a kit overall. */
  dominosMinimum: number
  perPilotHole: number
  /** Flat. */
  packing: number
  /** Flat estimate. */
  shipping: number
}

export interface EstimateLine {
  id: string
  label: string
  qty: number
  unitPrice: number
  total: number
}

export interface Estimate {
  lines: EstimateLine[]
  total: number
}

type SheetId = "4x8" | "5x5"

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function line(id: string, label: string, qty: number, unitPrice: number): EstimateLine {
  const u = cents(unitPrice)
  return { id, label, qty, unitPrice: u, total: cents(qty * u) }
}

const sumLines = (lines: EstimateLine[]) => cents(lines.reduce((n, l) => n + l.total, 0))

/** Unit price for a hardware item; unknown ids price at 0. */
function hardwareUnitPrice(item: HardwareItem, p: PriceBook): number {
  const id = item.id
  if (id.startsWith("hinge-butt")) return p.buttHingeEach
  if (id.startsWith("hinge-continuous")) return ((item.meta?.lengthMm ?? 0) / 1000) * p.continuousHingePerMeter
  switch (id) {
    case "lid-stay":
    case "lid-stay-chain":
      return p.lidStayEach
    case "lid-support":
      return p.lidSupportEach
    case "lid-pull":
      return p.pullEach
    case "lid-catch":
      return p.magneticCatchEach
    case "leg-dowel":
      return p.dowelEach
    case "leg-dowel-fastener":
      return p.legFastenerEach
    case "leg-screws-plate-bottom":
    case "leg-screws-plate-plate":
    case "screws-main":
      return p.screwEach
    case "glue":
      return p.glue
    case "pilot-bit":
      return p.pilotBit
    default:
      return 0
  }
}

const hardwareLines = (hardware: HardwareItem[], prices: PriceBook) =>
  hardware.map((h) => line(h.id, h.name, h.qty, hardwareUnitPrice(h, prices)))

export function diyEstimate(args: {
  sheets: number
  sheetId: SheetId
  hardware: HardwareItem[]
  prices: PriceBook
  sheetPriceOverride?: number
}): Estimate {
  const { sheets, sheetId, hardware, prices, sheetPriceOverride } = args
  const lines = [
    line("plywood", "Plywood", sheets, sheetPriceOverride ?? prices.sheet[sheetId]),
    ...hardwareLines(hardware, prices),
    line("finish", "Finish (allowance)", 1, prices.finishAllowance),
  ]
  return { lines, total: sumLines(lines) }
}

/** ceil(joint / spacing), but never fewer than `minimum` in total. */
export function dominoCount(jointLengthMm: number, spacingMm: number, minimum: number): number {
  const byLength = spacingMm > 0 && jointLengthMm > 0 ? Math.ceil(jointLengthMm / spacingMm) : 0
  return Math.max(byLength, minimum)
}

export function kitEstimate(args: {
  sheets: number
  sheetId: SheetId
  /** Parts cut from sheets, excluding dowels. */
  sheetParts: number
  jointLengthMm: number
  pilotHoles: number
  includeHardware: boolean
  hardware: HardwareItem[]
  prices: PriceBook
  rates: KitRates
  sheetPriceOverride?: number
}): Estimate & { dominos: number } {
  const { sheets, sheetId, sheetParts, jointLengthMm, pilotHoles, includeHardware, hardware, prices, rates } = args
  const dominos = dominoCount(jointLengthMm, rates.dominoSpacingMm, rates.dominosMinimum)
  const lines = [
    line("plywood", "Plywood sheets", sheets, args.sheetPriceOverride ?? prices.sheet[sheetId]),
    line("cutting", "Cutting", sheetParts, rates.perPartCut),
    line("dominos", "Dominos", dominos, rates.perDomino),
    line("pilot-holes", "Pilot holes", pilotHoles, rates.perPilotHole),
  ]
  if (includeHardware) {
    lines.push(line("hardware", "Hardware", 1, sumLines(hardwareLines(hardware, prices))))
  }
  lines.push(line("packing", "Packing", 1, rates.packing), line("shipping", "Shipping", 1, rates.shipping))
  return { lines, total: sumLines(lines), dominos }
}
