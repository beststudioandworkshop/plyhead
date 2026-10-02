import type { SheetPreset } from "./constants"
import type { Part, PartType } from "./types"

/**
 * Guillotine nesting of rectangular sheet-good parts. Pure and deterministic.
 *
 * Coordinates are millimetres with the origin at the sheet's top-left and y
 * pointing down. Every part is the rectangle `length × width` (thickness is
 * ignored; tapered polygon plates nest by their bounding rectangle).
 *
 * Grain semantics: a part with `grain !== null` may NOT rotate. The sheet's
 * grain is taken to run along sheet x, i.e. the part's `length` runs along
 * sheet x when unrotated.
 */

export interface Placement {
  partId: string
  name: string
  type: PartType
  x: number
  y: number
  /** Footprint size AFTER rotation. */
  w: number
  h: number
  rotated: boolean
}

export interface NestedSheet {
  index: number
  placements: Placement[]
  usedArea: number
}

export interface NestResult {
  sheet: SheetPreset
  kerf: number
  sheets: NestedSheet[]
  /** Parts bigger than the sheet in both orientations. */
  unplaced: Part[]
  /** Parts that aren't sheet goods (dowels). */
  excluded: Part[]
  /** Total area of placed footprints (mm²). */
  partArea: number
  /** partArea / (sheets × sheet area); 0 when there are no sheets. */
  yield: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const EPS = 1e-6

/** Split parts into sheet goods and things that aren't (cylinders / dowels). */
export function nestableParts(parts: Part[]): { sheetParts: Part[]; excluded: Part[] } {
  const sheetParts: Part[] = []
  const excluded: Part[] = []
  for (const p of parts) (p.shape === "cylinder" ? excluded : sheetParts).push(p)
  return { sheetParts, excluded }
}

interface Candidate {
  sheet: number
  rect: number
  rotated: boolean
  w: number
  h: number
  short: number
  long: number
}

function better(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true
  if (Math.abs(a.short - b.short) > EPS) return a.short < b.short
  if (Math.abs(a.long - b.long) > EPS) return a.long < b.long
  if (a.sheet !== b.sheet) return a.sheet < b.sheet
  return a.rect < b.rect
}

function split(r: Rect, w: number, h: number, kerf: number): Rect[] {
  const lw = r.w - w
  const lh = r.h - h
  const right: Rect = { x: r.x + w + kerf, y: r.y, w: r.w - w - kerf, h: r.h }
  const bottom: Rect = { x: r.x, y: r.y + h + kerf, w: r.w, h: r.h - h - kerf }
  // Shorter leftover axis rule: the thin side gets the short strip, the other
  // rect keeps the full extent so the bigger leftover stays as large as possible.
  if (lw < lh) right.h = h
  else bottom.w = w
  return [right, bottom].filter((q) => q.w > EPS && q.h > EPS)
}

export function nestParts(parts: Part[], sheet: SheetPreset, kerf: number): NestResult {
  const { sheetParts, excluded } = nestableParts(parts)
  const k = Math.max(0, kerf)

  const order = [...sheetParts].sort((a, b) => {
    const ma = Math.max(a.length, a.width)
    const mb = Math.max(b.length, b.width)
    if (ma !== mb) return mb - ma
    const aa = a.length * a.width
    const ab = b.length * b.width
    if (aa !== ab) return ab - aa
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const free: Rect[][] = []
  const sheets: NestedSheet[] = []
  const unplaced: Part[] = []

  const fresh = (): Rect[] => [{ x: 0, y: 0, w: sheet.w, h: sheet.h }]

  for (const part of order) {
    const orients: { w: number; h: number; rotated: boolean }[] = [
      { w: part.length, h: part.width, rotated: false },
    ]
    if (part.grain === null && Math.abs(part.length - part.width) > EPS) {
      orients.push({ w: part.width, h: part.length, rotated: true })
    }

    const search = (rectsOf: (s: number) => Rect[], count: number): Candidate | null => {
      let best: Candidate | null = null
      for (let s = 0; s < count; s++) {
        const rects = rectsOf(s)
        for (let r = 0; r < rects.length; r++) {
          for (const o of orients) {
            const rc = rects[r]
            if (o.w > rc.w + EPS || o.h > rc.h + EPS) continue
            const lw = rc.w - o.w
            const lh = rc.h - o.h
            const c: Candidate = {
              sheet: s,
              rect: r,
              rotated: o.rotated,
              w: o.w,
              h: o.h,
              short: Math.min(lw, lh),
              long: Math.max(lw, lh),
            }
            if (better(c, best)) best = c
          }
        }
      }
      return best
    }

    let pick = search((s) => free[s], free.length)
    if (!pick) {
      const empty = search(() => fresh(), 1)
      if (!empty) {
        unplaced.push(part)
        continue
      }
      free.push(fresh())
      sheets.push({ index: sheets.length, placements: [], usedArea: 0 })
      pick = { ...empty, sheet: free.length - 1, rect: 0 }
    }

    const rect = free[pick.sheet][pick.rect]
    sheets[pick.sheet].placements.push({
      partId: part.id,
      name: part.name,
      type: part.type,
      x: rect.x,
      y: rect.y,
      w: pick.w,
      h: pick.h,
      rotated: pick.rotated,
    })
    sheets[pick.sheet].usedArea += pick.w * pick.h
    free[pick.sheet].splice(pick.rect, 1, ...split(rect, pick.w, pick.h, k))
  }

  const partArea = sheets.reduce((n, s) => n + s.usedArea, 0)
  const total = sheets.length * sheet.w * sheet.h
  return {
    sheet,
    kerf: k,
    sheets,
    unplaced,
    excluded,
    partArea,
    yield: total > 0 ? partArea / total : 0,
  }
}
