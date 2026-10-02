import { FULL_LID_HINGE, LEAF_GAP_MM } from "./constants"
import type { Box, HingeEdge, LeafSide, LidPosition, LidType, Vec3 } from "./types"

export interface LidPanel {
  id: string
  name: string
  box: Box
  /** Absent on a fixed half. */
  hinge?: HingeEdge
}

/** Hinge line along an outer edge of a lid panel, on the outward-facing surface. */
function hingeLine(b: Box, edge: HingeEdge["edge"], lid: LidPosition): HingeEdge {
  const outerY = b.max[1] // top lid: upper surface
  const outerZ = b.max[2] // front lid: front surface
  let from: Vec3
  let to: Vec3
  if (edge === "back") {
    from = [b.min[0], outerY, b.min[2]]
    to = [b.max[0], outerY, b.min[2]]
  } else {
    const x = edge === "left" ? b.min[0] : b.max[0]
    if (lid === "top") {
      from = [x, outerY, b.min[2]]
      to = [x, outerY, b.max[2]]
    } else {
      from = [x, b.min[1], outerZ]
      to = [x, b.max[1], outerZ]
    }
  }
  return { edge, from, to }
}

function splitX(slab: Box, gap: number): [Box, Box] {
  const mid = (slab.min[0] + slab.max[0]) / 2
  return [
    { min: [...slab.min], max: [mid - gap / 2, slab.max[1], slab.max[2]] },
    { min: [mid + gap / 2, slab.min[1], slab.min[2]], max: [...slab.max] },
  ]
}

/**
 * Divide the lid slab into lid panels.
 *  - full:  one panel, hinged on FULL_LID_HINGE[lid].
 *  - split: two equal leaves split along the width, each hinged on its outer edge.
 *  - half:  same split; `openLeaf` opens (hinged on its outer edge), the other
 *           leaf is fixed and has no hinge.
 */
export function buildLid(
  slab: Box,
  lid: LidPosition,
  type: LidType,
  openLeaf: LeafSide,
  gap = LEAF_GAP_MM,
): LidPanel[] {
  if (type === "full") {
    return [{ id: "lid", name: "Lid", box: slab, hinge: hingeLine(slab, FULL_LID_HINGE[lid], lid) }]
  }

  const [left, right] = splitX(slab, type === "split" ? gap : 0)

  if (type === "split") {
    return [
      { id: "lid-left", name: "Lid leaf", box: left, hinge: hingeLine(left, "left", lid) },
      { id: "lid-right", name: "Lid leaf", box: right, hinge: hingeLine(right, "right", lid) },
    ]
  }

  const leftOpens = openLeaf === "left"
  return [
      {
        id: "lid-left",
        name: leftOpens ? "Lid (opening half)" : "Lid (fixed half)",
        box: left,
        hinge: leftOpens ? hingeLine(left, "left", lid) : undefined,
      },
      {
        id: "lid-right",
        name: leftOpens ? "Lid (fixed half)" : "Lid (opening half)",
        box: right,
        hinge: leftOpens ? undefined : hingeLine(right, "right", lid),
      },
  ]
}
