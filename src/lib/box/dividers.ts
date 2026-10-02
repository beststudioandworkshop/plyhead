import { MIN_DIVIDER_GAP_MM } from "./constants"
import { SPLIT_AXIS } from "./lid"
import { capitalize, dividerWord } from "./words"
import { partFromBox } from "./part"
import type { Axis, Box, Issue, LidPosition, LidType, Part, Vec3 } from "./types"

/**

 * Dividers always lie in a plane that contains the opening direction, so they never block access.
 *  - Top lid, split / half: one divider always sits under the seam so both leaves rest on it
 *    (so only odd counts are allowed: 1 or 3, evenly spaced, the middle one on the seam).
 *  - Top lid, full (or an open top): dividers run across the longer span of the opening.
 *  - Front door: they are horizontal SHELVES, evenly spaced up the inside, any count.
 * With more than one, they're spaced to leave equal clear gaps.
 */

const size = (b: Box): Vec3 => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]

/** The axis dividers are perpendicular to. */
export function dividerAxis(
  interior: Box,
  lid: LidPosition,
  lidType: LidType,
): Axis {
  // A box with a door gets horizontal shelves.
  if (lid === "front") return 1
  // Split and half lids divide across the width, so the divider goes under that seam.
  if (lidType === "split" || lidType === "half") return SPLIT_AXIS
  const s = size(interior)
  const [a, b]: [Axis, Axis] = lid === "top" ? [0, 2] : [0, 1]
  return s[a] >= s[b] ? a : b
}

/** Clear gap between neighbouring dividers/walls for `count` dividers of thickness `t`. */
export const dividerGap = (span: number, count: number, t: number) => (span - count * t) / (count + 1)

export function validateDividers(
  count: number,
  interior: Box,
  lid: LidPosition,
  lidType: LidType,
  t: number,
): Issue[] {
  if (count <= 0) return []
  // Evenly spaced dividers only land on the seam when there's an odd number of them.
  if (lid === "top" && (lidType === "split" || lidType === "half") && count % 2 === 0) {
    return [
      {
        code: "dividers-need-seam",
        message: "A split lid needs a divider under the seam, so use 1 or 3 dividers.",
        field: "dividers",
      },
    ]
  }
  const axis = dividerAxis(interior, lid, lidType)
  if (dividerGap(size(interior)[axis], count, t) < MIN_DIVIDER_GAP_MM) {
    return [
      {
        code: "dividers-no-room",
        message: "There's no room for that many dividers. Use fewer, or make the box bigger.",
        field: "dividers",
      },
    ]
  }
  return []
}

export function buildDividers(
  count: number,
  interior: Box,
  lid: LidPosition,
  lidType: LidType,
  t: number,
): Part[] {
  if (count <= 0) return []
  const axis = dividerAxis(interior, lid, lidType)
  const gap = dividerGap(size(interior)[axis], count, t)
  const parts: Part[] = []
  for (let i = 1; i <= count; i++) {
    const start = interior.min[axis] + i * gap + (i - 1) * t
    const min: Vec3 = [...interior.min]
    const max: Vec3 = [...interior.max]
    min[axis] = start
    max[axis] = start + t
    parts.push(partFromBox({ id: `divider-${i}`, name: capitalize(dividerWord(lid)), type: "divider" }, { min, max }, axis))
  }
  return parts
}

/**
 * A friendly nudge toward dividers, or null. Pure so the UI and tests share it.
 */
export function suggestDivider(
  count: number,
  interior: Box,
  lid: LidPosition,
  lidType: LidType,
  t: number,
  spanRatio: number,
): "seam" | "span" | null {
  if (count > 0 || lid === "front") return null
  if (lidType === "split" || lidType === "half") return "seam"
  const s = size(interior)
  const [a, b]: [Axis, Axis] = lid === "top" ? [0, 2] : [0, 1]
  return Math.max(s[a], s[b]) > spanRatio * t ? "span" : null
}
