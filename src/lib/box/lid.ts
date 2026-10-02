import { LEAF_GAP_MM } from "./constants"
import type { Axis, Box, HingeEdge, HingeSide, LeafSide, LidPosition, LidType, Vec3 } from "./types"

export interface LidPanel {
  id: string
  name: string
  box: Box
  /** Absent on a fixed half. */
  hinge?: HingeEdge
}

export interface LidAxes {
  /** Axis perpendicular to the lid surface (y for a top lid, z for a front lid). */
  normalAxis: Axis
  /** The hinge line runs along this axis. */
  hingeAxis: Axis
  /** Perpendicular to the hinge, in the lid plane: leaves split along it, hinges sit at its ends. */
  crossAxis: Axis
  /** Lid size along the hinge line, then across it (mm). */
  hingeLength: number
  crossLength: number
}

const planeAxes = (lid: LidPosition): [Axis, Axis] => (lid === "top" ? [0, 2] : [0, 1])

/**
 * Which way the hinge runs. "long" puts the hinge along the lid's longer edge,
 * "short" along its shorter edge (a tie counts x as the longer one).
 */
export function lidAxes(size: Vec3, lid: LidPosition, hingeSide: HingeSide): LidAxes {
  const [a, b] = planeAxes(lid)
  const longAxis = size[a] >= size[b] ? a : b
  const shortAxis = longAxis === a ? b : a
  const hingeAxis = hingeSide === "long" ? longAxis : shortAxis
  const crossAxis = hingeAxis === a ? b : a
  return {
    normalAxis: lid === "top" ? 1 : 2,
    hingeAxis,
    crossAxis,
    hingeLength: size[hingeAxis],
    crossLength: size[crossAxis],
  }
}

/** Name of the lid edge at the min/max end of an axis. */
const EDGE_NAME: Record<Axis, [HingeEdge["edge"], HingeEdge["edge"]]> = {
  0: ["left", "right"],
  1: ["bottom", "top"],
  2: ["back", "front"],
}

function hingeLine(b: Box, axes: LidAxes, end: "min" | "max"): HingeEdge {
  const from: Vec3 = [0, 0, 0]
  const to: Vec3 = [0, 0, 0]
  const cross = end === "min" ? b.min[axes.crossAxis] : b.max[axes.crossAxis]
  // On the inside face of the lid (the underside of a top lid, the back of a front lid).
  const inner = b.min[axes.normalAxis]
  from[axes.hingeAxis] = b.min[axes.hingeAxis]
  to[axes.hingeAxis] = b.max[axes.hingeAxis]
  from[axes.crossAxis] = to[axes.crossAxis] = cross
  from[axes.normalAxis] = to[axes.normalAxis] = inner
  return { edge: EDGE_NAME[axes.crossAxis][end === "min" ? 0 : 1], from, to }
}

function splitAcross(slab: Box, axis: Axis, gap: number): [Box, Box] {
  const mid = (slab.min[axis] + slab.max[axis]) / 2
  const first: Box = { min: [...slab.min], max: [...slab.max] }
  const second: Box = { min: [...slab.min], max: [...slab.max] }
  first.max[axis] = mid - gap / 2
  second.min[axis] = mid + gap / 2
  return [first, second]
}

/**
 * Divide the lid slab into lid panels.
 *  - full:  one panel, hinged on the min end of the cross axis
 *           (back for a top lid, bottom for a front lid, left for a vertical hinge).
 *  - split: two equal leaves split across the hinge direction; each hinges on its outer edge.
 *  - half:  same split; `openLeaf` (first = lower end of the cross axis) opens
 *           and has the hinge; the other leaf is fixed and has none.
 */
export function buildLid(
  slab: Box,
  lid: LidPosition,
  type: LidType,
  openLeaf: LeafSide,
  hingeSide: HingeSide,
  gap = LEAF_GAP_MM,
): LidPanel[] {
  const size: Vec3 = [
    slab.max[0] - slab.min[0],
    slab.max[1] - slab.min[1],
    slab.max[2] - slab.min[2],
  ]
  const axes = lidAxes(size, lid, hingeSide)

  if (type === "full") {
    return [{ id: "lid", name: "Lid", box: slab, hinge: hingeLine(slab, axes, "min") }]
  }

  const [first, second] = splitAcross(slab, axes.crossAxis, type === "split" ? gap : 0)

  if (type === "split") {
    return [
      { id: "lid-first", name: "Lid leaf", box: first, hinge: hingeLine(first, axes, "min") },
      { id: "lid-second", name: "Lid leaf", box: second, hinge: hingeLine(second, axes, "max") },
    ]
  }

  const firstOpens = openLeaf === "first"
  return [
    {
      id: "lid-first",
      name: firstOpens ? "Lid (opening half)" : "Lid (fixed half)",
      box: first,
      hinge: firstOpens ? hingeLine(first, axes, "min") : undefined,
    },
    {
      id: "lid-second",
      name: firstOpens ? "Lid (fixed half)" : "Lid (opening half)",
      box: second,
      hinge: firstOpens ? undefined : hingeLine(second, axes, "max"),
    },
  ]
}
