import type { NestResult, Placement } from "./nesting"
import type { Part, PartType } from "./types"

/**
 * DXF export of a nest via Maker.js (loaded lazily so it stays out of the
 * main bundle). DXF has y UP; nesting has y DOWN, so y is flipped per sheet.
 */

export interface DxfOptions {
  unit: "mm" | "in"
  /** Gap between sheets in mm (default 50). */
  sheetGap?: number
}

export const SHEET_LAYER = "SHEET"

export function layerName(type: PartType): string {
  return type.toUpperCase()
}

type Pt = [number, number]

/** Outline normalised to its bbox (min at 0); rotated 90° (pure rotation) when asked. */
function outlinePoints(outline: Pt[], rotated: boolean): Pt[] {
  const minX = Math.min(...outline.map((p) => p[0]))
  const minY = Math.min(...outline.map((p) => p[1]))
  const pts = outline.map((p): Pt => [p[0] - minX, p[1] - minY])
  if (!rotated) return pts
  const bw = Math.max(...pts.map((p) => p[1]))
  // (u, v) -> (bw - v, u): counter-clockwise quarter turn, then shifted back to the origin.
  return pts.map(([u, v]): Pt => [bw - v, u])
}

export async function buildDxf(nest: NestResult, parts: Part[], opts: DxfOptions): Promise<string> {
  const mod = await import("makerjs")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makerjs: any = (mod as any).default ?? mod

  const gap = opts.sheetGap ?? 50
  const k = opts.unit === "in" ? 1 / 25.4 : 1
  const byId = new Map(parts.map((p) => [p.id, p]))
  const { sheet } = nest

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models: Record<string, any> = {}

  const shapeFor = (pl: Placement) => {
    const part = byId.get(pl.partId)
    if (part?.shape === "polygon" && part.outline && part.outline.length >= 3) {
      const pts = outlinePoints(part.outline, pl.rotated).map(([x, y]): Pt => [x * k, y * k])
      return new makerjs.models.ConnectTheDots(true, pts)
    }
    return new makerjs.models.Rectangle(pl.w * k, pl.h * k)
  }

  nest.sheets.forEach((s, i) => {
    const ox = i * (sheet.w + gap)
    models[`sheet${i}`] = {
      layer: SHEET_LAYER,
      origin: [ox * k, 0],
      ...new makerjs.models.Rectangle(sheet.w * k, sheet.h * k),
    }
    s.placements.forEach((pl, j) => {
      models[`s${i}p${j}`] = {
        layer: layerName(pl.type),
        origin: [(ox + pl.x) * k, (sheet.h - pl.y - pl.h) * k],
        ...shapeFor(pl),
      }
    })
  })

  const unit = opts.unit === "in" ? makerjs.unitType.Inch : makerjs.unitType.Millimeter
  // Coordinates are already in the target unit; `units` just stamps $INSUNITS.
  return makerjs.exporter.toDXF({ models }, { units: unit, accuracy: 0.000001 })
}
