/**
 * Shared types for the plywood box tool. Pure data only — no React, no Three.
 *
 * World frame (matches Three.js, Y up), all lengths in millimetres:
 *   x = width  (left → right)
 *   y = height (bottom → top)
 *   z = depth  (back → front; the front face is at z = depth)
 * The box exterior occupies [0,W] × [0,H] × [0,D].
 */

export type Vec3 = [number, number, number]

export type Axis = 0 | 1 | 2

export interface Box {
  min: Vec3
  max: Vec3
}

/** Width / depth / height in millimetres. */
export interface Dims {
  w: number
  d: number
  h: number
}

export type LidPosition = "top" | "front"
export type LidType = "full" | "split" | "half"
export type DimensionMode = "exterior" | "interior"
export type Unit = "in" | "mm"
export type JoineryId = "butt"
/** Where the bottom panel sits. "inset": between the walls. "lap": under the walls, so they bear on it. */
export type BottomStyle = "inset" | "lap"
/** Which half of a split/half lid: "first" is the lower end of the cross axis (back, bottom or left). */
export type LeafSide = "first" | "second"
/** Whether the lid hinges along its long or its short edge. */
export type HingeSide = "long" | "short"

export type PartType = "side" | "front" | "back" | "top" | "bottom" | "lid" | "leg" | "divider"

/** Grain direction relative to the part's length. Unused in v1; reserved. */
export type Grain = "length" | "width" | null

export type LegStyle = "none" | "dowel" | "tapered"

/**
 * Legs always attach to the bottom. Two styles:
 *  - dowel:   four round dowels at the corners.
 *  - tapered: at each corner, two plywood plates joined in an L around the
 *             corner, narrowing from `width` at the top to `footWidth` at the floor.
 */
export interface LegInputs {
  style: LegStyle
  /** How far the legs project below the bottom (mm). */
  height: number
  /** Dowel diameter (mm). Dowels only. */
  diameter: number
  /** Distance from the bottom's edges to the dowel's outer surface (mm). Dowels only. */
  inset: number
  /** Outer size of the L at the top, i.e. plate width at the top (mm). Tapered only. */
  width: number
  /** Outer size of the L at the foot (mm). Tapered only. */
  footWidth: number
}

export interface BoxInputs {
  dimensionMode: DimensionMode
  /** Exterior or interior W × D × H depending on dimensionMode (mm). */
  dims: Dims
  /** Interior mode only: total slack added to each interior dimension (mm). */
  clearance: number
  /** Plywood thickness (mm). */
  thickness: number
  lidPosition: LidPosition
  lidType: LidType
  /** Half lid only: which leaf opens. The other is fixed. */
  openLeaf: LeafSide
  hingeSide: HingeSide
  bottomStyle: BottomStyle
  /** Number of internal dividers (0 to MAX_DIVIDERS). */
  dividers: number
  legs: LegInputs
  joinery: JoineryId
}

export type PartShape = "box" | "cylinder" | "polygon"

export interface HingeEdge {
  edge: "left" | "right" | "back" | "front" | "bottom" | "top"
  /** Hinge line in world coordinates (mm). */
  from: Vec3
  to: Vec3
}

/**
 * One physical board. `length >= width` is not guaranteed for legs, but the
 * cut dimensions are always (length × width × thickness).
 *
 * Local frame: X = length, Y = thickness, Z = width. `rotation` is an Euler
 * XYZ (radians, Three.js convention) taking that local frame to the world, and
 * `center` is the part's centre in the world frame. `extents` is the resulting
 * axis-aligned world size, handy for renderers that don't want to rotate.
 */
export interface Part {
  id: string
  name: string
  type: PartType
  length: number
  width: number
  thickness: number
  center: Vec3
  rotation: Vec3
  extents: Vec3
  /** "box" for ordinary boards, "cylinder" for dowels, "polygon" for tapered plates. */
  shape: PartShape
  /**
   * Polygon parts only: the outline in the part's local frame (x = along
   * length, y = across width, both relative to `center`), in mm.
   * The board is `thickness` thick, centred on this outline's plane.
   */
  outline?: [number, number][]
  /** Tapered plates only: width at the foot (mm). `width` is the width at the top. */
  footWidth?: number
  grain: Grain
  hinge?: HingeEdge
}

export type IssueCode =
  | "non-positive-dimension"
  | "non-positive-thickness"
  | "interior-too-small"
  | "legs-invalid-size"
  | "legs-too-large-for-face"
  | "legs-foot-too-narrow"
  | "dividers-no-room"
  | "dividers-need-seam"

export interface Issue {
  code: IssueCode
  message: string
  field?: string
}

export interface BoxResult {
  ok: boolean
  issues: Issue[]
  exterior: Dims
  interior: Dims
  /** Empty when `ok` is false. */
  parts: Part[]
  /** Bounding box of everything, legs included. */
  bounds: Box
}
