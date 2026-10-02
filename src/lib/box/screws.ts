import { MM_PER_INCH } from "./constants"

/**
 * Rule-of-thumb fastener advice for butt joints in plywood. Not engineering:
 * it's the sort of thing a shop would tell you at the counter.
 */

/** How far a screw should bite into the receiving panel (mm). */
export const SCREW_BITE_MM = 25

/** Common wood-screw lengths (inches) and metric lengths (mm), shortest first. */
const IMPERIAL_LENGTHS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const METRIC_LENGTHS = [25, 30, 35, 40, 45, 50, 60, 70, 80]

export interface ScrewAdvice {
  /** US gauge, e.g. "#8". */
  gauge: "#6" | "#8"
  /** Nominal shank diameter (mm). */
  shankMm: number
  /** Pilot hole in the receiving panel (mm). */
  pilotMm: number
  /** Clearance hole in the panel the screw passes through (mm). */
  clearanceMm: number
  /** Minimum screw length: panel thickness plus the bite (mm). */
  minLengthMm: number
  /** Recommended stock length, imperial (inches) and metric (mm). */
  lengthIn: number
  lengthMetricMm: number
  /** Gap between screws along a joint (mm): [min, max]. */
  spacingMm: [number, number]
}

export function screwAdvice(thicknessMm: number): ScrewAdvice {
  const minLengthMm = thicknessMm + SCREW_BITE_MM
  const thin = thicknessMm < 10
  return {
    gauge: thin ? "#6" : "#8",
    shankMm: thin ? 3.5 : 4.2,
    pilotMm: thin ? 2.5 : 3,
    clearanceMm: thin ? 3.5 : 4.2,
    minLengthMm,
    lengthIn:
      IMPERIAL_LENGTHS.find((l) => l * MM_PER_INCH >= minLengthMm - 1e-9) ??
      IMPERIAL_LENGTHS[IMPERIAL_LENGTHS.length - 1],
    lengthMetricMm:
      METRIC_LENGTHS.find((l) => l >= minLengthMm - 1e-9) ?? METRIC_LENGTHS[METRIC_LENGTHS.length - 1],
    spacingMm: [100, 150],
  }
}
