import { FRACTION_DENOMINATOR, MM_PER_INCH } from "./constants"
import type { Unit } from "./types"

export const inToMm = (inches: number) => inches * MM_PER_INCH
export const mmToIn = (mm: number) => mm / MM_PER_INCH

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Round to the nearest 1/16" and format as a mixed number, e.g. `1 1/2"`. */
export function formatInches(mm: number, suffix = true): string {
  const sixteenths = Math.round((mmToIn(Math.abs(mm)) * FRACTION_DENOMINATOR) + 1e-9)
  const sign = mm < 0 && sixteenths !== 0 ? "-" : ""
  const whole = Math.floor(sixteenths / FRACTION_DENOMINATOR)
  const rem = sixteenths % FRACTION_DENOMINATOR
  const unit = suffix ? '"' : ""
  if (rem === 0) return `${sign}${whole}${unit}`
  const g = gcd(rem, FRACTION_DENOMINATOR)
  const frac = `${rem / g}/${FRACTION_DENOMINATOR / g}`
  return whole === 0 ? `${sign}${frac}${unit}` : `${sign}${whole} ${frac}${unit}`
}

/** Millimetres with at most `digits` decimals, trailing zeros trimmed. */
export function formatMillimetres(mm: number, suffix = true, digits = 1): string {
  const text = String(Number(mm.toFixed(digits)))
  return suffix ? `${text} mm` : text
}

/** Length for display: 1/16" fractions or mm. */
export function formatLength(mm: number, unit: Unit, suffix = true): string {
  return unit === "in" ? formatInches(mm, suffix) : formatMillimetres(mm, suffix)
}

/**
 * Thickness for display. Fractions would hide real plywood thicknesses (0.71"
 * is not 11/16"), so inches are shown as trimmed decimals.
 */
export function formatThickness(mm: number, unit: Unit, suffix = true): string {
  if (unit === "mm") return formatMillimetres(mm, suffix, 2)
  const text = String(Number(mmToIn(mm).toFixed(3)))
  return suffix ? `${text}"` : text
}

const NUMBER = String.raw`(\d+(?:\.\d+)?|\.\d+)`

/**
 * Parse user text into millimetres. Accepts `12`, `12.5`, `3/4`, `1 1/2`,
 * `1-1/2`, with optional `"`, `in`, or `mm` suffix. A bare number uses
 * `defaultUnit`. Returns null if it can't be read.
 */
export function parseLength(text: string, defaultUnit: Unit): number | null {
  let s = text.trim().toLowerCase().replace(/[,]/g, "")
  if (!s) return null

  let unit: Unit = defaultUnit
  if (s.endsWith("mm")) {
    unit = "mm"
    s = s.slice(0, -2).trim()
  } else if (s.endsWith('"') || s.endsWith("in") || s.endsWith("inch")) {
    unit = "in"
    s = s.replace(/("|inch|in)$/, "").trim()
  }
  if (!s) return null

  s = s.replace(/^(\d+)-(?=\d+\/)/, "$1 ")

  let value: number | null = null
  let m: RegExpMatchArray | null
  if ((m = s.match(new RegExp(`^${NUMBER}$`)))) {
    value = parseFloat(m[1])
  } else if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) {
    value = Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2])
  } else if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) {
    value = Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3])
  }
  if (value === null || !Number.isFinite(value)) return null
  return unit === "in" ? inToMm(value) : value
}
