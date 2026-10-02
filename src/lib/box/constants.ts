import type { Dims, JoineryId } from "./types"

/**
 * Construction assumptions for v1. Everything the geometry depends on that is a
 * choice (not a calculation) lives here so it is easy to find and change.
 */

export const MM_PER_INCH = 25.4

/** Fractional inch display resolution: 1/16". */
export const FRACTION_DENOMINATOR = 16

/** Lengths are rounded to this many mm decimals when parts are built. */
export const PART_PRECISION_MM = 3

export const DEFAULT_JOINERY: JoineryId = "butt"

/**
 * Interior mode: clearance is the TOTAL slack added to each interior
 * dimension (not per side). 1/8" total by default.
 */
export const DEFAULT_CLEARANCE_MM = MM_PER_INCH / 8

/** Gap between the two leaves of a split lid (mm). 0 = leaves meet exactly. */
export const LEAF_GAP_MM = 0

/** Saw kerf used when nesting (consumed in step 4). */
export const DEFAULT_KERF_MM = MM_PER_INCH / 8

export interface ThicknessPreset {
  id: string
  label: string
  /** Real thickness in mm. */
  mm: number
}

/** Real thicknesses of "nominal" plywood, plus metric. */
export const THICKNESS_PRESETS: ThicknessPreset[] = [
  { id: "half", label: '1/2" nominal (0.47")', mm: 0.47 * MM_PER_INCH },
  { id: "three-quarter", label: '3/4" nominal (0.71")', mm: 0.71 * MM_PER_INCH },
  { id: "12mm", label: "12 mm", mm: 12 },
  { id: "18mm", label: "18 mm", mm: 18 },
]

export const DEFAULT_EXTERIOR: Dims = {
  w: 18 * MM_PER_INCH,
  d: 12 * MM_PER_INCH,
  h: 10 * MM_PER_INCH,
}

export const DEFAULT_LEGS = {
  height: 4 * MM_PER_INCH,
  /** Thick dowels. */
  diameter: 1.5 * MM_PER_INCH,
  inset: 0.5 * MM_PER_INCH,
  /** Tapered plywood corner legs: L outer size at the top and at the floor. */
  width: 3 * MM_PER_INCH,
  footWidth: 1.5 * MM_PER_INCH,
}
