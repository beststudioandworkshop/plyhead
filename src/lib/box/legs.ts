import { polygonPart, partFromBox } from "./part"
import type { Axis, Dims, Issue, LegInputs, Part, Vec3 } from "./types"

/**
 * Legs always attach to the bottom and project below it (y from -height to 0).
 * Corner order everywhere: back-left, back-right, front-left, front-right.
 */

const corners = (ext: Dims) => [
  { left: true, back: true },
  { left: false, back: true },
  { left: true, back: false },
  { left: false, back: false },
].map((c) => ({ ...c, x0: c.left ? 0 : ext.w, z0: c.back ? 0 : ext.d }))

export function validateLegs(legs: LegInputs, thickness: number, ext: Dims): Issue[] {
  if (legs.style === "none") return []
  const issues: Issue[] = []
  const bad = (message: string) =>
    issues.push({ code: "legs-invalid-size", message, field: "legs" })

  if (!(legs.height > 0)) bad("Leg height must be greater than zero.")

  const half = Math.min(ext.w, ext.d) / 2

  if (legs.style === "dowel") {
    if (!(legs.diameter > 0) || !(legs.inset >= 0)) {
      bad("Dowel diameter must be greater than zero, and the inset can't be negative.")
    } else if (legs.inset + legs.diameter > half + 1e-9) {
      issues.push({
        code: "legs-too-large-for-face",
        message: "The dowels (diameter plus inset) don't fit on the bottom. Use thinner dowels or a smaller inset.",
        field: "legs",
      })
    }
  } else {
    if (!(legs.width > 0) || !(legs.footWidth > 0)) {
      bad("Leg widths must be greater than zero.")
    } else if (legs.footWidth > legs.width) {
      bad("The foot can't be wider than the top of the leg.")
    } else if (legs.footWidth <= thickness) {
      issues.push({
        code: "legs-foot-too-narrow",
        message: "The foot must be wider than the plywood is thick, or the second plate disappears.",
        field: "legs",
      })
    } else if (legs.width > half + 1e-9) {
      issues.push({
        code: "legs-too-large-for-face",
        message: "The legs are too wide for the bottom. Reduce the top width.",
        field: "legs",
      })
    }
  }
  return issues
}

export function buildLegParts(legs: LegInputs, thickness: number, ext: Dims): Part[] {
  if (legs.style === "none") return []
  const h = legs.height
  const parts: Part[] = []

  if (legs.style === "dowel") {
    const r = legs.diameter / 2
    corners(ext).forEach((c, i) => {
      const cx = c.left ? legs.inset + r : ext.w - legs.inset - r
      const cz = c.back ? legs.inset + r : ext.d - legs.inset - r
      parts.push(
        partFromBox(
          { id: `leg-${i + 1}`, name: "Dowel leg", type: "leg", shape: "cylinder" },
          { min: [cx - r, -h, cz - r], max: [cx + r, 0, cz + r] },
          0,
          1,
        ),
      )
    })
    return parts
  }

  // Tapered: plate A hugs the front/back face and runs along x at full width.
  // Plate B hugs the side face and runs along z, starting where A ends, so
  // the pair makes an L whose outer corner is flush with the box.
  const W = legs.width
  const F = legs.footWidth
  const t = thickness
  corners(ext).forEach((c, i) => {
    const sx = c.left ? 1 : -1
    const sz = c.back ? 1 : -1

    const zA = c.back ? t / 2 : ext.d - t / 2
    const vertsA: Vec3[] = [
      [c.x0, 0, zA],
      [c.x0 + sx * W, 0, zA],
      [c.x0 + sx * F, -h, zA],
      [c.x0, -h, zA],
    ]
    parts.push(
      polygonPart(
        { id: `leg-${i + 1}-a`, name: "Leg plate A", type: "leg", footWidth: F },
        vertsA,
        2,
        1 as Axis,
        t,
      ),
    )

    const xB = c.left ? t / 2 : ext.w - t / 2
    const zInner = c.back ? t : ext.d - t
    const vertsB: Vec3[] = [
      [xB, 0, zInner],
      [xB, 0, c.z0 + sz * W],
      [xB, -h, c.z0 + sz * F],
      [xB, -h, zInner],
    ]
    parts.push(
      polygonPart(
        { id: `leg-${i + 1}-b`, name: "Leg plate B", type: "leg", footWidth: F - t },
        vertsB,
        0,
        1 as Axis,
        t,
      ),
    )
  })
  return parts
}
