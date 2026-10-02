import { JOINERY } from "./joinery"
import { buildLid } from "./lid"
import { buildLegParts, validateLegs } from "./legs"
import { partFromBox, roundVec } from "./part"
import type { Axis, Box, BoxInputs, BoxResult, Dims, Issue, Part, Vec3 } from "./types"

/** Resolve exterior and interior dimensions from the inputs. */
export function resolveDimensions(inputs: BoxInputs): { exterior: Dims; interior: Dims } {
  const joinery = JOINERY[inputs.joinery]
  const t = inputs.thickness
  if (inputs.dimensionMode === "exterior") {
    return { exterior: inputs.dims, interior: joinery.interiorFromExterior(inputs.dims, t) }
  }
  const wanted: Dims = {
    w: inputs.dims.w + inputs.clearance,
    d: inputs.dims.d + inputs.clearance,
    h: inputs.dims.h + inputs.clearance,
  }
  return { exterior: joinery.exteriorFromInterior(wanted, t), interior: wanted }
}

function validate(inputs: BoxInputs, exterior: Dims, interior: Dims): Issue[] {
  const issues: Issue[] = []
  const { w, d, h } = inputs.dims
  if (![w, d, h].every((n) => Number.isFinite(n) && n > 0)) {
    issues.push({
      code: "non-positive-dimension",
      message: "Width, depth and height must all be greater than zero.",
      field: "dims",
    })
  }
  if (!(inputs.thickness > 0) || !Number.isFinite(inputs.thickness)) {
    issues.push({
      code: "non-positive-thickness",
      message: "Plywood thickness must be greater than zero.",
      field: "thickness",
    })
  }
  if (issues.length) return issues

  if (interior.w <= 0 || interior.d <= 0 || interior.h <= 0) {
    issues.push({
      code: "interior-too-small",
      message: "The box is too small for this plywood thickness: there's no room left inside.",
      field: "dims",
    })
    return issues
  }
  return validateLegs(inputs.legs, inputs.thickness, exterior)
}

const EMPTY_BOUNDS: Box = { min: [0, 0, 0], max: [0, 0, 0] }

/**
 * The one entry point: inputs → everything downstream needs.
 * The 3D view, cut list, nesting and DXF should all read `parts`.
 */
export function buildBox(inputs: BoxInputs): BoxResult {
  const { exterior, interior } = resolveDimensions(inputs)
  const issues = validate(inputs, exterior, interior)
  if (issues.length) {
    return { ok: false, issues, exterior, interior, parts: [], bounds: EMPTY_BOUNDS }
  }

  const t = inputs.thickness
  const layout = JOINERY[inputs.joinery].layout(exterior, t, inputs.lidPosition)
  const parts: Part[] = []

  for (const panel of layout.carcass) {
    parts.push(
      partFromBox({ id: panel.key, name: panel.name, type: panel.type }, panel.box, panel.thicknessAxis),
    )
  }

  const lidThicknessAxis: Axis = inputs.lidPosition === "top" ? 1 : 2
  for (const lid of buildLid(layout.lidSlab, inputs.lidPosition, inputs.lidType, inputs.openLeaf, inputs.hingeSide)) {
    parts.push(
      partFromBox(
        { id: lid.id, name: lid.name, type: "lid", hinge: lid.hinge },
        lid.box,
        lidThicknessAxis,
      ),
    )
  }

  parts.push(...buildLegParts(inputs.legs, t, exterior))

  return { ok: true, issues: [], exterior, interior, parts, bounds: boundsOf(parts) }
}

function boundsOf(parts: Part[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of parts) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p.center[a] - p.extents[a] / 2)
      max[a] = Math.max(max[a], p.center[a] + p.extents[a] / 2)
    }
  }
  return { min: roundVec(min), max: roundVec(max) }
}
