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
 */

export type ScrewTierId = "good" | "better"

export const SCREW_TIERS: Record<ScrewTierId, { biteMm: number; spacingMm: number }> = {
  good: { biteMm: 1 * MM_PER_INCH, spacingMm: 8 * MM_PER_INCH },
  better: { biteMm: 1.5 * MM_PER_INCH, spacingMm: 10 * MM_PER_INCH },
}

/** Common wood-screw lengths (inches) and metric lengths (mm), shortest first. */
const IMPERIAL_LENGTHS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]
const METRIC_LENGTHS = [25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]

export interface ScrewTierAdvice {
  /** How far the screw should reach into the second panel (mm). */
  biteMm: number
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
  /** Pilot hole in the receiving panel (mm). */
  pilotMm: number
  /** Clearance hole in the panel the screw passes through (mm). */
  clearanceMm: number
  good: ScrewTierAdvice
  better: ScrewTierAdvice
}

function tierAdvice(thicknessMm: number, tier: ScrewTierId): ScrewTierAdvice {
  const { biteMm, spacingMm } = SCREW_TIERS[tier]
  const minLengthMm = thicknessMm + biteMm
  return {
    biteMm,
    minLengthMm,
    lengthIn:
      IMPERIAL_LENGTHS.find((l) => l * MM_PER_INCH >= minLengthMm - 1e-9) ??
      IMPERIAL_LENGTHS[IMPERIAL_LENGTHS.length - 1],
    lengthMetricMm:
      METRIC_LENGTHS.find((l) => l >= minLengthMm - 1e-9) ?? METRIC_LENGTHS[METRIC_LENGTHS.length - 1],
    spacingMm,
  }
}

export function screwAdvice(thicknessMm: number): ScrewAdvice {
  const thin = thicknessMm < 10
  return {
    gauge: thin ? "#6" : "#8",
    shankMm: thin ? 3.5 : 4.2,
    pilotMm: thin ? 2.5 : 3,
    clearanceMm: thin ? 3.5 : 4.2,
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
