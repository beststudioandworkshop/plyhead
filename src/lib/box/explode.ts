import type { Box, Part, Vec3 } from "./types"

/**
 * Exploded-view helpers. Pure maths, shared by the 3D preview and its tests.
 */

/** Largest/smallest axis index of a part's world extents. */
function axisOf(extents: Vec3, pick: "min" | "max"): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0
  for (const a of [1, 2] as const) {
    if (pick === "max" ? extents[a] > extents[best] : extents[a] < extents[best]) best = a
  }
  return best
}

/**
 * How far to push a part away from the box centre when exploded.
 * Panels move along their thickness axis (the way they'd be pulled off), legs
 * drop straight down, and dividers stay put. The direction is away from `boxCenter`.
 * Returns a vector with at most one non-zero component, of size `distance`
 * (all zero for dividers).
 */
export function explodeOffset(part: Part, boxCenter: Vec3, distance: number): Vec3 {
  // Legs are always on the bottom, so they drop straight down.
  if (part.type === "leg") return [0, -distance, 0]
  // Dividers stay exactly where they sit in the assembled box.
  if (part.type === "divider") return [0, 0, 0]
  const axis = axisOf(part.extents, "min")
  const sign = part.center[axis] >= boxCenter[axis] ? 1 : -1
  const out: Vec3 = [0, 0, 0]
  out[axis] = sign * distance
  return out
}

/** Centre of a box. */
export function centerOf(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
}

/** Radius of a sphere that contains the bounds, grown by `explodeDistance` when exploded. */
export function viewRadius(b: Box, explodeDistance = 0): number {
  const dx = b.max[0] - b.min[0]
  const dy = b.max[1] - b.min[1]
  const dz = b.max[2] - b.min[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / 2 + explodeDistance
}

/** Default explode distance for a box: a fraction of its smallest exterior dimension. */
export function defaultExplodeDistance(ext: { w: number; d: number; h: number }): number {
  return Math.min(ext.w, ext.d, ext.h) * 0.5
}

/**
 * Staging for the exploded-view animation. A single timeline `t` runs 0 → 1
 * when exploding and 1 → 0 when collapsing; each part starts later the
 * further down this list it is. So exploding goes lid first, then the walls,
 * then the bottom and legs, and collapsing runs in exactly the reverse order.
 */
const EXPLODE_ORDER: Record<Part["type"], number> = {
  lid: 0,
  top: 0.1,
  divider: 0.25,
  side: 0.5,
  front: 0.5,
  back: 0.5,
  bottom: 0.8,
  leg: 1,
}

/** Fraction of the timeline over which the start times are spread out. */
export const EXPLODE_STAGGER = 0.4

export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

/** Where a part is (0 = home, 1 = fully exploded) when the timeline is at `t`. */
export function partProgress(t: number, type: Part["type"]): number {
  const delay = EXPLODE_STAGGER * EXPLODE_ORDER[type]
  const local = (t - delay) / (1 - EXPLODE_STAGGER)
  return easeInOutCubic(Math.min(1, Math.max(0, local)))
}
