import { PART_PRECISION_MM } from "./constants"
import { boxCenter, boxSize, eulerFromAxes, inverseRotateVec } from "./rotation"
import type { Axis, Box, Part, PartShape, Vec3 } from "./types"

export const round = (n: number) => {
  const f = 10 ** PART_PRECISION_MM
  const r = Math.round(n * f) / f
  return Object.is(r, -0) ? 0 : r
}
export const roundVec = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])]

export interface PartBase {
  id: string
  name: string
  type: Part["type"]
  shape?: PartShape
  hinge?: Part["hinge"]
  footWidth?: number
}

/** Turn a world-space box into a Part, given which axis is the thickness. */
export function partFromBox(base: PartBase, b: Box, thicknessAxis: Axis, lengthAxis?: Axis): Part {
  const size = boxSize(b)
  const rest = ([0, 1, 2] as Axis[]).filter((a) => a !== thicknessAxis)
  // Length runs along the longer remaining axis unless the caller says otherwise.
  const [lAxis, wAxis] =
    lengthAxis !== undefined
      ? [lengthAxis, rest.find((a) => a !== lengthAxis)!]
      : size[rest[1]] > size[rest[0]]
        ? [rest[1], rest[0]]
        : [rest[0], rest[1]]

  return {
    id: base.id,
    name: base.name,
    type: base.type,
    shape: base.shape ?? "box",
    ...(base.hinge ? { hinge: base.hinge } : {}),
    ...(base.footWidth !== undefined ? { footWidth: round(base.footWidth) } : {}),
    length: round(size[lAxis]),
    width: round(size[wAxis]),
    thickness: round(size[thicknessAxis]),
    center: roundVec(boxCenter(b)),
    rotation: eulerFromAxes(lAxis, thicknessAxis, wAxis),
    extents: roundVec(size),
    grain: null,
  }
}

/**
 * A flat plywood plate with a polygon outline. `verts` are world-space points
 * lying in the plate's mid-plane; the plate is `thickness` thick across
 * `thicknessAxis`, centred on that plane.
 */
export function polygonPart(
  base: PartBase,
  verts: Vec3[],
  thicknessAxis: Axis,
  lengthAxis: Axis,
  thickness: number,
): Part {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const v of verts) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], v[a])
      max[a] = Math.max(max[a], v[a])
    }
  }
  min[thicknessAxis] -= thickness / 2
  max[thicknessAxis] += thickness / 2

  const part = partFromBox({ ...base, shape: "polygon" }, { min, max }, thicknessAxis, lengthAxis)
  // Express the outline in the part's own frame so it stays correct under its rotation.
  const outline = verts.map((v): [number, number] => {
    const local = inverseRotateVec(part.rotation, [
      v[0] - part.center[0],
      v[1] - part.center[1],
      v[2] - part.center[2],
    ])
    return [round(local[0]), round(local[2])]
  })
  return { ...part, outline }
}
