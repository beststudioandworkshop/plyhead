import { formatLength, formatThickness } from "./units"
import type { Part, PartShape, PartType, Unit } from "./types"

export interface CutListRow {
  name: string
  type: PartType
  shape: PartShape
  /** Tapered plates: width at the foot (mm); `width` is the top width. */
  footWidth?: number
  quantity: number
  /** Cut dimensions in mm. */
  length: number
  width: number
  thickness: number
  partIds: string[]
}

/** Dimensions closer than this (mm) count as the same cut. */
const SAME_CUT_MM = 0.01

/** Group identical parts (same name and cut size) into rows, in first-seen order. */
export function groupParts(parts: Part[]): CutListRow[] {
  const rows: CutListRow[] = []
  for (const p of parts) {
    const row = rows.find(
      (r) =>
        r.name === p.name &&
        r.shape === p.shape &&
        Math.abs((r.footWidth ?? 0) - (p.footWidth ?? 0)) < SAME_CUT_MM &&
        Math.abs(r.length - p.length) < SAME_CUT_MM &&
        Math.abs(r.width - p.width) < SAME_CUT_MM &&
        Math.abs(r.thickness - p.thickness) < SAME_CUT_MM,
    )
    if (row) {
      row.quantity += 1
      row.partIds.push(p.id)
    } else {
      rows.push({
        name: p.name,
        type: p.type,
        shape: p.shape,
        ...(p.footWidth !== undefined ? { footWidth: p.footWidth } : {}),
        quantity: 1,
        length: p.length,
        width: p.width,
        thickness: p.thickness,
        partIds: [p.id],
      })
    }
  }
  return rows
}

export interface CutListCells {
  name: string
  quantity: string
  length: string
  width: string
  thickness: string
}

/**
 * Display strings for a row: 1/16" fractions (or mm), thickness as a decimal.
 * Dowels show their diameter (Ø) and no thickness; tapered plates show
 * top → foot width.
 */
export function formatRow(row: CutListRow, unit: Unit): CutListCells {
  const base = {
    name: row.name,
    quantity: String(row.quantity),
    length: formatLength(row.length, unit),
  }
  if (row.shape === "cylinder") {
    return { ...base, width: `Ø${formatLength(row.width, unit)}`, thickness: "round" }
  }
  const thickness = formatThickness(row.thickness, unit)
  if (row.shape === "polygon" && row.footWidth !== undefined) {
    return {
      ...base,
      width: `${formatLength(row.width, unit)} → ${formatLength(row.footWidth, unit)}`,
      thickness,
    }
  }
  return { ...base, width: formatLength(row.width, unit), thickness }
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/**
 * CSV with display columns (in the chosen unit) followed by exact millimetre
 * columns, so a spreadsheet or CAM tool can use the numbers directly.
 */
export function cutListToCsv(rows: CutListRow[], unit: Unit): string {
  const header = ["Part", "Qty", "Length", "Width", "Thickness", "Length mm", "Width mm", "Thickness mm"]
  const lines = [header.join(",")]
  for (const row of rows) {
    const c = formatRow(row, unit)
    lines.push(
      [
        c.name,
        c.quantity,
        c.length,
        c.width,
        c.thickness,
        row.length.toFixed(2),
        row.width.toFixed(2),
        row.thickness.toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    )
  }
  return lines.join("\r\n") + "\r\n"
}

/** Plain-text table for pasting into a message or notes app. */
export function cutListToText(rows: CutListRow[], unit: Unit): string {
  const cells = rows.map((r) => formatRow(r, unit))
  const lines = cells.map((c) => `${c.quantity}x  ${c.name}  ${c.length} x ${c.width} x ${c.thickness}`)
  return lines.join("\n")
}
