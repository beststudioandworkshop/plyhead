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
 * Panels move along their thickness axis (the way they'd be pulled off),
 * legs along their length. The direction is away from `boxCenter`.
 * Returns a vector with at most one non-zero component, of size `distance`.
 */
export function explodeOffset(part: Part, boxCenter: Vec3, distance: number): Vec3 {
  const axis = axisOf(part.extents, part.type === "leg" ? "max" : "min")
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
