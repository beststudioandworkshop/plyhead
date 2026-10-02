/**
 * Share-link encoding for the box tool. Pure and framework-free: works in Node
 * and browsers (TextEncoder/TextDecoder + btoa/atob, no Buffer).
 *
 * Format: base64url (no padding) of compact JSON `{ v: 1, ... }`. Decoding is
 * strict because the input comes from a URL: every field is validated and the
 * result is rebuilt field by field, so unknown keys are dropped and
 * `__proto__` tricks cannot leak into the output.
 */
import { MAX_DIVIDERS, SHEET_PRESETS, THICKNESS_PRESETS } from "./constants"
import type { RoundingMode } from "./rounding"
import type {
  BoxInputs,
  BottomStyle,
  DimensionMode,
  HingeSide,
  LeafSide,
  LegStyle,
  LidPosition,
  LidType,
  Unit,
} from "./types"

export interface ShareState {
  inputs: BoxInputs
  unit: Unit
  rounding: RoundingMode
  sheetId: "4x8" | "5x5"
  kerfMm: number
  /** THICKNESS_PRESETS id, or "custom". */
  thicknessPreset: string
}

const VERSION = 1
const MAX_INPUT_LENGTH = 2000

const round3 = (n: number): number => Math.round(n * 1000) / 1000

function enc(state: ShareState) {
  const { inputs: i } = state
  return {
    v: VERSION,
    u: state.unit,
    r: state.rounding,
    s: state.sheetId,
    k: round3(state.kerfMm),
    t: state.thicknessPreset,
    i: {
      m: i.dimensionMode,
      d: { w: round3(i.dims.w), d: round3(i.dims.d), h: round3(i.dims.h) },
      c: round3(i.clearance),
      th: round3(i.thickness),
      lp: i.lidPosition,
      lt: i.lidType,
      ol: i.openLeaf,
      hs: i.hingeSide,
      bs: i.bottomStyle,
      dv: i.dividers,
      j: i.joinery,
      l: {
        s: i.legs.style,
        h: round3(i.legs.height),
        d: round3(i.legs.diameter),
        i: round3(i.legs.inset),
        w: round3(i.legs.width),
        f: round3(i.legs.footWidth),
      },
    },
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ""
  for (let n = 0; n < bytes.length; n++) bin += String.fromCharCode(bytes[n])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): string | null {
  if (typeof atob !== "function") return null
  let b64 = text.replace(/-/g, "+").replace(/_/g, "/")
  if (b64.length % 4 === 1) return null
  while (b64.length % 4) b64 += "="
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n)
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}

export function encodeShare(state: ShareState): string {
  return toBase64Url(JSON.stringify(enc(state)))
}

// ---------------------------------------------------------------------------
// Validation helpers. All return undefined on failure (never throw).

type Rec = Record<string, unknown>

const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x)
const own = (o: Rec, k: string): unknown =>
  Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined

function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T | undefined {
  return typeof x === "string" && (allowed as readonly string[]).includes(x) ? (x as T) : undefined
}

function num(x: unknown, min: number, max: number): number | undefined {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : undefined
}

function int(x: unknown, min: number, max: number): number | undefined {
  const n = num(x, min, max)
  return n !== undefined && Number.isInteger(n) ? n : undefined
}

export function decodeShare(text: string | null | undefined): ShareState | null {
  try {
    if (typeof text !== "string" || text.length === 0 || text.length > MAX_INPUT_LENGTH) return null
    if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
    const json = fromBase64Url(text)
    if (json === null) return null
    const root: unknown = JSON.parse(json)
    if (!isRec(root) || own(root, "v") !== VERSION) return null

    const i = own(root, "i")
    if (!isRec(i)) return null
    const dims = own(i, "d")
    const legs = own(i, "l")
    if (!isRec(dims) || !isRec(legs)) return null

    const unit = oneOf(own(root, "u"), ["in", "mm"] as const)
    const rounding = oneOf(own(root, "r"), ["exact", "easier"] as const)
    const sheetId = oneOf(own(root, "s"), SHEET_PRESETS.map((p) => p.id))
    const kerfMm = num(own(root, "k"), 0, 20)
    const thicknessPreset = oneOf(own(root, "t"), ["custom", ...THICKNESS_PRESETS.map((p) => p.id)])

    const dimensionMode = oneOf<DimensionMode>(own(i, "m"), ["exterior", "interior"])
    const w = num(own(dims, "w"), 1, 10000)
    const d = num(own(dims, "d"), 1, 10000)
    const h = num(own(dims, "h"), 1, 10000)
    const clearance = num(own(i, "c"), 0, 200)
    const thickness = num(own(i, "th"), 1, 100)
    const lidPosition = oneOf<LidPosition>(own(i, "lp"), ["top", "front"])
    const lidType = oneOf<LidType>(own(i, "lt"), ["full", "split", "half"])
    const openLeaf = oneOf<LeafSide>(own(i, "ol"), ["first", "second"])
    const hingeSide = oneOf<HingeSide>(own(i, "hs"), ["long", "short"])
    const bottomStyle = oneOf<BottomStyle>(own(i, "bs"), ["inset", "lap"])
    const dividers = int(own(i, "dv"), 0, MAX_DIVIDERS)
    const joinery = oneOf(own(i, "j"), ["butt"] as const)

    const style = oneOf<LegStyle>(own(legs, "s"), ["none", "dowel", "tapered"])
    const height = num(own(legs, "h"), 1, 2000)
    const diameter = num(own(legs, "d"), 1, 500)
    const inset = num(own(legs, "i"), 0, 500)
    const width = num(own(legs, "w"), 1, 1000)
    const footWidth = num(own(legs, "f"), 1, 1000)

    if (
      unit === undefined || rounding === undefined || sheetId === undefined ||
      kerfMm === undefined || thicknessPreset === undefined ||
      dimensionMode === undefined || w === undefined || d === undefined || h === undefined ||
      clearance === undefined || thickness === undefined || lidPosition === undefined ||
      lidType === undefined || openLeaf === undefined || hingeSide === undefined ||
      bottomStyle === undefined || dividers === undefined || joinery === undefined ||
      style === undefined || height === undefined || diameter === undefined ||
      inset === undefined || width === undefined || footWidth === undefined
    ) {
      return null
    }

    return {
      inputs: {
        dimensionMode,
        dims: { w, d, h },
        clearance,
        thickness,
        lidPosition,
        lidType,
        openLeaf,
        hingeSide,
        bottomStyle,
        dividers,
        legs: { style, height, diameter, inset, width, footWidth },
        joinery,
      },
      unit,
      rounding,
      sheetId,
      kerfMm,
      thicknessPreset,
    }
  } catch {
    return null
  }
}

export function shareUrl(origin: string, state: ShareState): string {
  return `${origin}/tools/box?d=${encodeShare(state)}`
}
