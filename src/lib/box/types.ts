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

export type Face = "top" | "bottom" | "front" | "back" | "left" | "right"
export type LidPosition = "top" | "front"
export type LidType = "full" | "split" | "half"
export type DimensionMode = "exterior" | "interior"
export type Unit = "in" | "mm"
export type JoineryId = "butt"
export type LeafSide = "left" | "right"

export type PartType = "side" | "front" | "back" | "top" | "bottom" | "lid" | "leg"

/** Grain direction relative to the part's length. Unused in v1; reserved. */
export type Grain = "length" | "width" | null

export interface LegInputs {
  /** Face the legs attach to, or null for no legs. */
  face: Face | null
  /** How far the legs project from the face (mm). */
  height: number
  /** Square post section (mm). */
  section: number
  /** Distance from the face edges to the leg's outer faces (mm). */
  inset: number
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
  legs: LegInputs
  joinery: JoineryId
}

export interface HingeEdge {
  edge: "left" | "right" | "back"
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
  grain: Grain
  hinge?: HingeEdge
}

export type IssueCode =
  | "non-positive-dimension"
  | "non-positive-thickness"
  | "interior-too-small"
  | "legs-on-lid-face"
  | "legs-invalid-size"
  | "legs-too-large-for-face"

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
