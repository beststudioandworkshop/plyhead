import { MM_PER_INCH } from "./constants"
import type { Dims, LidPosition } from "./types"

/**
 * Rule-of-thumb fastener advice for butt joints in plywood. Not engineering:
 * it's the sort of thing a shop would tell you at the counter.
 *
 * Screw length is a MINIMUM. Quantity matters as much as length, so there are
 * two tiers:
 *   good:   1" of bite into the second panel, a screw about every 8"
 *   better: 1 1/2" of bite, a screw about every 10"
 * Bite is fenced between 1" and 2" either way.
 */

export type ScrewTierId = "good" | "better"

/**
 * The fence: never less than 1" of bite, and never more than 2". Under an inch
 * doesn't hold; over two risks the screw breaking through the side.
 */
export const MIN_BITE_MM = 1 * MM_PER_INCH
export const MAX_BITE_MM = 2 * MM_PER_INCH

/** Pilot holes are always 1/8". Countersink the heads: it's worth it on a project like this. */
export const PILOT_HOLE_MM = MM_PER_INCH / 8

export const SCREW_TIERS: Record<ScrewTierId, { biteMm: number; spacingMm: number }> = {
  good: { biteMm: 1 * MM_PER_INCH, spacingMm: 8 * MM_PER_INCH },
  better: { biteMm: 1.5 * MM_PER_INCH, spacingMm: 10 * MM_PER_INCH },
}

/** Common wood-screw lengths (inches) and metric lengths (mm), shortest first. */
const IMPERIAL_LENGTHS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]
const METRIC_LENGTHS = [25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]

export interface ScrewTierAdvice {
  /** How far the screw should reach into the second panel (mm), inside the fence. */
  biteMm: number
  /** The bite you actually get with the stock length chosen (mm). */
  actualBiteMm: number
  /** Minimum screw length: panel thickness plus the bite (mm). */
  minLengthMm: number
  /** Stock length that meets the minimum: imperial (inches) and metric (mm). */
  lengthIn: number
  lengthMetricMm: number
  /** Gap between screws along a joint (mm). */
  spacingMm: number
}

export interface ScrewAdvice {
  /** US gauge, e.g. "#8". */
  gauge: "#6" | "#8"
  /** Nominal shank diameter (mm). */
  shankMm: number
  /** Pilot hole (mm): always 1/8". */
  pilotMm: number
  good: ScrewTierAdvice
  better: ScrewTierAdvice
}

/**
 * Smallest stock length that gives at least `wantedBite`, unless that would
 * bite past the fence, in which case the longest stock that stays inside it.
 */
function pickStock(stock: number[], toMm: (l: number) => number, thicknessMm: number, wantedBite: number): number {
  const fits = (l: number, bite: number) => toMm(l) - thicknessMm >= bite - 1e-9
  const first = stock.find((l) => fits(l, wantedBite)) ?? stock[stock.length - 1]
  if (toMm(first) - thicknessMm <= MAX_BITE_MM + 1e-9) return first
  const inside = [...stock].reverse().find((l) => toMm(l) - thicknessMm <= MAX_BITE_MM + 1e-9 && fits(l, MIN_BITE_MM))
  return inside ?? first
}

function tierAdvice(thicknessMm: number, tier: ScrewTierId): ScrewTierAdvice {
  const { spacingMm } = SCREW_TIERS[tier]
  const biteMm = Math.min(MAX_BITE_MM, Math.max(MIN_BITE_MM, SCREW_TIERS[tier].biteMm))
  const lengthIn = pickStock(IMPERIAL_LENGTHS, (l) => l * MM_PER_INCH, thicknessMm, biteMm)
  const lengthMetricMm = pickStock(METRIC_LENGTHS, (l) => l, thicknessMm, biteMm)
  return {
    biteMm,
    actualBiteMm: lengthIn * MM_PER_INCH - thicknessMm,
    minLengthMm: thicknessMm + biteMm,
    lengthIn,
    lengthMetricMm,
    spacingMm,
  }
}

export function screwAdvice(thicknessMm: number): ScrewAdvice {
  const thin = thicknessMm < 10
  return {
    gauge: thin ? "#6" : "#8",
    shankMm: thin ? 3.5 : 4.2,
    pilotMm: PILOT_HOLE_MM,
    good: tierAdvice(thicknessMm, "good"),
    better: tierAdvice(thicknessMm, "better"),
  }
}

/**
 * Rough total length of screwed joints (mm): the four corners, the bottom's
 * perimeter, the top panel on a front-lid box, and two walls per divider.
 * Meant for "about N screws", not a bill of materials.
 */
export function estimateJointLength(ext: Dims, lid: LidPosition, dividers: number): number {
  const corners = 4 * ext.h
  const bottom = 2 * (ext.w + ext.d)
  const topPanel = lid === "front" ? ext.w + 2 * ext.d : 0
  const dividerEdges = dividers * 2 * ext.h
  return corners + bottom + topPanel + dividerEdges
}

/** Screws needed for a joint length at a given spacing (at least one per started span). */
export const screwCount = (jointLengthMm: number, spacingMm: number) => Math.ceil(jointLengthMm / spacingMm)
