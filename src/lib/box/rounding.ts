import { MM_PER_INCH } from "./constants"
import { round } from "./part"
import type { Part, Unit } from "./types"

/**
 * "Make it easier": round the cut sizes to friendlier numbers. Everything the
 * user actually cuts from (cut list, sheet layout, DXF) can use the rounded
 * parts, while the 3D preview keeps the exact ones.
 */

export type RoundingMode = "exact" | "easier"

/** Rounding step: 1/8" in inches, 1 mm in millimetres. */
export const roundingStep = (unit: Unit) => (unit === "in" ? MM_PER_INCH / 8 : 1)

/** Nearest multiple of `step`, never less than one step. */
const snap = (value: number, step: number) => round(Math.max(step, Math.round(value / step + 1e-9) * step))

const EPS = 1e-6

/**
 * Re-draw a tapered plate's outline for rounded sizes. The outline is a
 * trapezoid with one edge shared by both ends (the straight edge at the box
 * corner); the top end is the wider one. Falls back to a plain scale if the
 * outline isn't that shape.
 */
function remapOutline(
  outline: [number, number][],
  length: number,
  width: number,
  foot: number,
  oldLength: number,
  oldWidth: number,
): [number, number][] {
  const scale = () => outline.map(([u, v]): [number, number] => [round((u * length) / oldLength), round((v * width) / oldWidth)])
  if (outline.length !== 4) return scale()

  const uMin = Math.min(...outline.map((p) => p[0]))
  const uMax = Math.max(...outline.map((p) => p[0]))
  const vMin = Math.min(...outline.map((p) => p[1]))
  const vMax = Math.max(...outline.map((p) => p[1]))
  const end = (u: number) => outline.filter((p) => Math.abs(p[0] - u) < EPS)
  const lo = end(uMin)
  const hi = end(uMax)
  if (lo.length !== 2 || hi.length !== 2) return scale()

  const span = (pts: [number, number][]) => Math.abs(pts[0][1] - pts[1][1])
  const topIsHigh = span(hi) >= span(lo)

  // Which side of the plate is the straight, shared edge?
  const flushLow = lo.some((p) => Math.abs(p[1] - vMin) < EPS) && hi.some((p) => Math.abs(p[1] - vMin) < EPS)
  const flushHigh = lo.some((p) => Math.abs(p[1] - vMax) < EPS) && hi.some((p) => Math.abs(p[1] - vMax) < EPS)
  if (!flushLow && !flushHigh) return scale()

  return outline.map(([u, v]): [number, number] => {
    const atHigh = Math.abs(u - uMax) < EPS
    const isTop = atHigh === topIsHigh
    const endSpan = isTop ? width : foot
    const u2 = atHigh ? length / 2 : -length / 2
    const onFlush = flushLow ? Math.abs(v - vMin) < EPS : Math.abs(v - vMax) < EPS
    let v2: number
    if (flushLow) v2 = onFlush ? -width / 2 : -width / 2 + endSpan
    else v2 = onFlush ? width / 2 : width / 2 - endSpan
    return [round(u2), round(v2)]
  })
}

/**
 * Round each part's cut length and width to the nearest `step` (thickness is
 * the plywood's and is left alone). Position, extents and rotation stay exact,
 * so only things that read the cut sizes are affected.
 */
export function roundParts(parts: Part[], step: number): Part[] {
  return parts.map((p) => {
    if (p.shape === "cylinder") {
      const diameter = snap(p.width, step)
      return { ...p, length: snap(p.length, step), width: diameter, thickness: diameter }
    }
    const length = snap(p.length, step)
    const width = snap(p.width, step)
    if (p.shape === "polygon" && p.outline && p.footWidth !== undefined) {
      const foot = Math.min(snap(p.footWidth, step), width)
      return {
        ...p,
        length,
        width,
        footWidth: foot,
        outline: remapOutline(p.outline, length, width, foot, p.length, p.width),
      }
    }
    return { ...p, length, width }
  })
}
