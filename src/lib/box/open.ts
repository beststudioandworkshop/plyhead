import { easeInOutCubic } from "./explode"
import type { LidPosition, Part, Vec3 } from "./types"

/**
 * The "open" view: each hinged lid or door swings about its hinge line while
 * the rest of the box stays put. Pure maths shared by the 3D scene and tests.
 */

export interface OpenSpec {
  /** A point on the hinge line (world, mm). */
  pivot: Vec3
  /** Unit vector along the hinge line. */
  axis: Vec3
  /** Signed angle (radians) about `axis` when fully open; positive follows the right-hand rule. */
  angle: number
  /** 0 for the first leaf, 1 for the second. */
  rank: number
  /** How many leaves open (1 or 2), which sets the stagger. */
  leaves: number
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const DEGREES = Math.PI / 180
/** Most lids and side-hinged doors open about this far. */
export const OPEN_ANGLE = 100 * DEGREES
/** A door hinged at the bottom drops to horizontal. */
export const DROP_DOWN_ANGLE = 90 * DEGREES
/** The second leaf starts opening once the first is this far through the timeline. */
export const OPEN_STAGGER = 0.4

/** Outward normal of the lid/door face. */
const outward = (position: LidPosition): Vec3 => (position === "top" ? [0, 1, 0] : [0, 0, 1])

/**
 * How to open each hinged part, keyed by part id. Parts without a hinge (a
 * fixed half) don't appear. The swing direction is whichever way carries the
 * leaf up and out of the box.
 */
export function openSpecs(parts: Part[], position: LidPosition): Map<string, OpenSpec> {
  const hinged = parts.filter((p) => p.type === "lid" && p.hinge)
  const n = outward(position)
  const specs = new Map<string, OpenSpec>()
  hinged.forEach((part, rank) => {
    const { from, to, edge } = part.hinge!
    const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const axis: Vec3 = [(to[0] - from[0]) / len, (to[1] - from[1]) / len, (to[2] - from[2]) / len]
    // Direction from the hinge into the leaf, across the hinge line.
    const toCentre = sub(part.center, from)
    const along = dot(toCentre, axis)
    const d: Vec3 = [toCentre[0] - axis[0] * along, toCentre[1] - axis[1] * along, toCentre[2] - axis[2] * along]
    const sign = dot(axis, cross(d, n)) >= 0 ? 1 : -1
    const magnitude = edge === "bottom" ? DROP_DOWN_ANGLE : OPEN_ANGLE
    specs.set(part.id, { pivot: from, axis, angle: sign * magnitude, rank, leaves: hinged.length })
  })
  return specs
}

/** 0 (closed) to 1 (open) for a leaf when the timeline is at `t`. The second leaf lags the first. */
export function openProgress(t: number, rank: number, leaves: number): number {
  const stagger = leaves > 1 ? OPEN_STAGGER : 0
  const local = (t - stagger * rank) / (1 - stagger)
  return easeInOutCubic(Math.min(1, Math.max(0, local)))
}

/** Rotate a vector about a unit axis (Rodrigues). */
export function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = cross(axis, v)
  const kd = dot(axis, v) * (1 - c)
  return [v[0] * c + k[0] * s + axis[0] * kd, v[1] * c + k[1] * s + axis[1] * kd, v[2] * c + k[2] * s + axis[2] * kd]
}
