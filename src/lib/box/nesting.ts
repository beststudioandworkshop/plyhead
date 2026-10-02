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

/** Which cut direction the plan starts with. "auto" tries every strategy and keeps the best. */
export type FirstCut = "auto" | "rip" | "cross"

/** Strategy that produced a layout. "free" picks the split direction per piece (shorter leftover first). */
export type NestStrategy = "rip" | "cross" | "free"

export interface NestOptions {
  firstCut?: FirstCut
}

/**
 * One straight edge-to-edge saw cut across the panel currently being cut.
 *
 * Trim cuts: a leftover on an axis wider than 0 but not wider than the kerf
 * still gets a cut (it removes the sliver) but yields no reusable free panel.
 * Trim cuts are ordinary cuts here and obey the rip/cross alternation.
 *
 * Alternation exception (forced "rip"/"cross" strategies): a panel normally
 * takes the OPPOSITE axis of the cut that produced it. When the piece placed in
 * a panel already spans it along that opposite cut (no leftover), that cut would
 * be empty and is skipped, so the only needed cut is on the same axis as the
 * parent. The same applies to the root: if the first piece spans the whole
 * sheet along the forced axis, the first cut is on the other axis.
 */
export interface Cut {
  /** 1-based order within the sheet. */
  index: number
  /** rip = parallel to the sheet's long edge, cross = perpendicular. Long edge is y if sheet.h >= sheet.w. */
  axis: "rip" | "cross"
  /** Line direction in sheet coordinates (vertical = constant x). */
  orientation: "vertical" | "horizontal"
  /** The panel being divided (mm). */
  panel: { x: number; y: number; w: number; h: number }
  /** Distance from the panel's near edge (left / top) to the finished edge of the piece side; the kerf is taken from the waste side. */
  offset: number
  /** Absolute position of that finished edge: panel.x + offset (vertical) or panel.y + offset (horizontal). */
  position: number
  /** Cut length = panel extent along the line. */
  length: number
}

export interface NestedSheet {
  index: number
  placements: Placement[]
  usedArea: number
  /** Ordered cut plan (depth-first over the cut tree). */
  cuts: Cut[]
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
  /** Total number of saw cuts over all sheets. */
  cutCount: number
  /** Sum of all cut lengths (mm). */
  cutLength: number
  /** Strategy that produced this layout. */
  strategy: NestStrategy
}

const EPS = 1e-6

/** Split parts into sheet goods and things that aren't (cylinders / dowels). */
export function nestableParts(parts: Part[]): { sheetParts: Part[]; excluded: Part[] } {
  const sheetParts: Part[] = []
  const excluded: Part[] = []
  for (const p of parts) (p.shape === "cylinder" ? excluded : sheetParts).push(p)
  return { sheetParts, excluded }
}

type Axis = "rip" | "cross"
type Orientation = "vertical" | "horizontal"

/** A panel in the cut tree: a free leaf, a finished piece, or a panel divided by one cut. */
interface Node {
  x: number
  y: number
  w: number
  h: number
  /** Axis of the cut that produced this panel (virtual for the root). */
  parentAxis: Axis
  kind: "free" | "piece" | "split"
  orientation?: Orientation
  offset?: number
  near?: Node
  far?: Node | null
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

const idCmp = (a: Part, b: Part) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const maxD = (p: Part) => Math.max(p.length, p.width)
const minD = (p: Part) => Math.min(p.length, p.width)
const areaOf = (p: Part) => p.length * p.width

/**
 * Part orderings tried per strategy (the first is the original one). The
 * min-dimension orderings group parts of equal strip width so they share a
 * rip strip.
 */
const ORDERINGS: ((a: Part, b: Part) => number)[] = [
  (a, b) => maxD(b) - maxD(a) || areaOf(b) - areaOf(a) || idCmp(a, b),
  (a, b) => areaOf(b) - areaOf(a) || maxD(b) - maxD(a) || idCmp(a, b),
  (a, b) => minD(b) - minD(a) || maxD(b) - maxD(a) || idCmp(a, b),
  (a, b) => maxD(b) - maxD(a) || minD(b) - minD(a) || idCmp(a, b),
]

function emitCuts(root: Node, axisOf: (o: Orientation) => Axis): Cut[] {
  const out: Cut[] = []
  const walk = (n: Node) => {
    if (n.kind !== "split" || !n.orientation || n.offset === undefined || !n.near) return
    const vertical = n.orientation === "vertical"
    out.push({
      index: out.length + 1,
      axis: axisOf(n.orientation),
      orientation: n.orientation,
      panel: { x: n.x, y: n.y, w: n.w, h: n.h },
      offset: n.offset,
      position: vertical ? n.x + n.offset : n.y + n.offset,
      length: vertical ? n.h : n.w,
    })
    walk(n.near)
    if (n.far) walk(n.far)
  }
  walk(root)
  return out
}

function pack(order: Part[], excluded: Part[], sheet: SheetPreset, k: number, strategy: NestStrategy): NestResult {
  const longIsY = sheet.h >= sheet.w
  const axisOf = (o: Orientation): Axis => ((o === "vertical") === longIsY ? "rip" : "cross")
  const orientOf = (a: Axis): Orientation => ((a === "rip") === longIsY ? "vertical" : "horizontal")
  const opposite = (a: Axis): Axis => (a === "rip" ? "cross" : "rip")

  const roots: Node[] = []
  const free: Node[][] = []
  const sheets: NestedSheet[] = []
  const unplaced: Part[] = []

  const freshRoot = (): Node => ({
    x: 0,
    y: 0,
    w: sheet.w,
    h: sheet.h,
    // The root "was produced" by the opposite axis so that its preferred first cut is the strategy's.
    parentAxis: strategy === "free" ? "cross" : opposite(strategy),
    kind: "free",
  })

  /** Cut `n` at `size` along `o`; returns the far (waste-side) free panel, if any. */
  const cutAt = (n: Node, o: Orientation, size: number): { near: Node; far: Node | null } => {
    const vertical = o === "vertical"
    const axis = axisOf(o)
    const near: Node = vertical
      ? { x: n.x, y: n.y, w: size, h: n.h, parentAxis: axis, kind: "free" }
      : { x: n.x, y: n.y, w: n.w, h: size, parentAxis: axis, kind: "free" }
    const rest = (vertical ? n.w : n.h) - size - k
    let far: Node | null = null
    if (rest > EPS) {
      far = vertical
        ? { x: n.x + size + k, y: n.y, w: rest, h: n.h, parentAxis: axis, kind: "free" }
        : { x: n.x, y: n.y + size + k, w: n.w, h: rest, parentAxis: axis, kind: "free" }
    }
    n.kind = "split"
    n.orientation = o
    n.offset = size
    n.near = near
    n.far = far
    return { near, far }
  }

  /** Place a w×h piece at the top-left of free node n; returns the new free [right, bottom] panels. */
  const place = (n: Node, w: number, h: number): [Node | null, Node | null] => {
    const lw = n.w - w
    const lh = n.h - h
    const needV = lw > EPS
    const needH = lh > EPS
    if (!needV && !needH) {
      n.kind = "piece"
      return [null, null]
    }
    let first: Orientation
    if (needV && needH) {
      first = strategy === "free" ? (lw < lh ? "horizontal" : "vertical") : orientOf(opposite(n.parentAxis))
    } else {
      first = needV ? "vertical" : "horizontal"
    }
    const second: Orientation = first === "vertical" ? "horizontal" : "vertical"
    let right: Node | null = null
    let bottom: Node | null = null
    let cur = n
    for (const o of [first, second]) {
      if (o === "vertical" ? !needV : !needH) continue
      const { near, far } = cutAt(cur, o, o === "vertical" ? w : h)
      if (o === "vertical") right = far
      else bottom = far
      cur = near
    }
    cur.kind = "piece"
    return [right, bottom]
  }

  for (const part of order) {
    const orients: { w: number; h: number; rotated: boolean }[] = [
      { w: part.length, h: part.width, rotated: false },
    ]
    if (part.grain === null && Math.abs(part.length - part.width) > EPS) {
      orients.push({ w: part.width, h: part.length, rotated: true })
    }

    const search = (rectsOf: (s: number) => Node[], count: number): Candidate | null => {
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
      const empty = search(() => [freshRoot()], 1)
      if (!empty) {
        unplaced.push(part)
        continue
      }
      const root = freshRoot()
      roots.push(root)
      free.push([root])
      sheets.push({ index: sheets.length, placements: [], usedArea: 0, cuts: [] })
      pick = { ...empty, sheet: free.length - 1, rect: 0 }
    }

    const node = free[pick.sheet][pick.rect]
    sheets[pick.sheet].placements.push({
      partId: part.id,
      name: part.name,
      type: part.type,
      x: node.x,
      y: node.y,
      w: pick.w,
      h: pick.h,
      rotated: pick.rotated,
    })
    sheets[pick.sheet].usedArea += pick.w * pick.h
    const [right, bottom] = place(node, pick.w, pick.h)
    free[pick.sheet].splice(pick.rect, 1, ...[right, bottom].filter((q): q is Node => q !== null))
  }

  let cutCount = 0
  let cutLength = 0
  sheets.forEach((s, i) => {
    s.cuts = emitCuts(roots[i], axisOf)
    cutCount += s.cuts.length
    for (const c of s.cuts) cutLength += c.length
  })

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
    cutCount,
    cutLength,
    strategy,
  }
}

/** Fewest sheets, then fewest cuts, then shorter total cut length, then higher yield. */
function beats(a: NestResult, b: NestResult): boolean {
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length
  if (a.cutCount !== b.cutCount) return a.cutCount < b.cutCount
  if (Math.abs(a.cutLength - b.cutLength) > EPS) return a.cutLength < b.cutLength
  if (Math.abs(a.yield - b.yield) > 1e-12) return a.yield > b.yield
  return false
}

export function nestParts(
  parts: Part[],
  sheet: SheetPreset,
  kerf: number,
  options: NestOptions = {},
): NestResult {
  const { sheetParts, excluded } = nestableParts(parts)
  const k = Math.max(0, kerf)
  const firstCut = options.firstCut ?? "auto"
  const strategies: NestStrategy[] = firstCut === "auto" ? ["rip", "cross", "free"] : [firstCut]
  const orders = ORDERINGS.map((cmp) => [...sheetParts].sort(cmp))

  // Strategies are tried in rip < cross < free order and only a strictly better
  // result replaces the incumbent, so ties resolve deterministically.
  let best: NestResult | null = null
  for (const strategy of strategies) {
    for (const order of orders) {
      const r = pack(order, excluded, sheet, k, strategy)
      if (!best || beats(r, best)) best = r
    }
  }
  return best as NestResult
}
