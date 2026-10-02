import { LEG_FACES } from "./constants"
import type { Axis, Box, Dims, Face, Issue, LegInputs, LidPosition, Vec3 } from "./types"

export interface FaceOption {
  face: Face
  enabled: boolean
  reason?: string
}

/** Which leg faces are selectable for a given lid position (for greying out). */
export function legFaceOptions(lid: LidPosition): FaceOption[] {
  return LEG_FACES.map((face) =>
    face === lid
      ? { face, enabled: false, reason: "The lid is on this face" }
      : { face, enabled: true },
  )
}

/** Normal axis (0=x,1=y,2=z) and direction of each face. */
const FACE_NORMAL: Record<Face, { axis: Axis; sign: 1 | -1 }> = {
  top: { axis: 1, sign: 1 },
  bottom: { axis: 1, sign: -1 },
  front: { axis: 2, sign: 1 },
  back: { axis: 2, sign: -1 },
  right: { axis: 0, sign: 1 },
  left: { axis: 0, sign: -1 },
}

const dimsToVec = (e: Dims): Vec3 => [e.w, e.h, e.d]

export function validateLegs(legs: LegInputs, lid: LidPosition, ext: Dims): Issue[] {
  if (legs.face === null) return []
  const issues: Issue[] = []

  if (legs.face === lid) {
    issues.push({
      code: "legs-on-lid-face",
      message: `Legs can't go on the ${lid}, because that's where the lid is.`,
      field: "legs.face",
    })
    return issues
  }

  if (!(legs.height > 0) || !(legs.section > 0) || legs.inset < 0 || !Number.isFinite(legs.inset)) {
    issues.push({
      code: "legs-invalid-size",
      message: "Leg height and section must be positive, and the inset can't be negative.",
      field: "legs",
    })
    return issues
  }

  const extV = dimsToVec(ext)
  const { axis } = FACE_NORMAL[legs.face]
  const inPlane = ([0, 1, 2] as Axis[]).filter((a) => a !== axis)
  for (const a of inPlane) {
    if (legs.inset + legs.section > extV[a] / 2 + 1e-9) {
      issues.push({
        code: "legs-too-large-for-face",
        message: "The legs (section plus inset) don't fit on that face. Reduce the section or the inset.",
        field: "legs",
      })
      break
    }
  }
  return issues
}

/** Four corner posts on the chosen face, as world-space boxes. */
export function buildLegBoxes(legs: LegInputs, ext: Dims): { box: Box; lengthAxis: Axis }[] {
  if (legs.face === null) return []
  const extV = dimsToVec(ext)
  const { axis, sign } = FACE_NORMAL[legs.face]
  const [a, b] = ([0, 1, 2] as Axis[]).filter((x) => x !== axis)
  const s = legs.section
  const spans = (len: number): [number, number][] => [
    [legs.inset, legs.inset + s],
    [len - legs.inset - s, len - legs.inset],
  ]
  const out: { box: Box; lengthAxis: Axis }[] = []
  for (const [a0, a1] of spans(extV[a])) {
    for (const [b0, b1] of spans(extV[b])) {
      const min: Vec3 = [0, 0, 0]
      const max: Vec3 = [0, 0, 0]
      min[a] = a0
      max[a] = a1
      min[b] = b0
      max[b] = b1
      if (sign === 1) {
        min[axis] = extV[axis]
        max[axis] = extV[axis] + legs.height
      } else {
        min[axis] = -legs.height
        max[axis] = 0
      }
      out.push({ box: { min, max }, lengthAxis: axis })
    }
  }
  return out
}
