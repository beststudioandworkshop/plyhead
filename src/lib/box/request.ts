import { formatLength } from "./units"
import type { BoxInputs, Dims, Unit } from "./types"

/**
 * Builds the text of a build request (email subject and body) from a design.
 * Pure so it's easy to test; the UI just opens a mailto: with the result.
 */

export interface RequestContact {
  name: string
  email: string
  zip: string
  notes: string
}

export interface RequestArgs {
  kind: "kit"
  contact: RequestContact
  inputs: BoxInputs
  exterior: Dims
  interior: Dims
  unit: Unit
  /** Link that reopens this exact design. */
  link: string
  /** Estimated total, formatted (e.g. "$214.50"), and whether it's an example price. */
  estimate?: { total: string; example: boolean }
}

const MAX_NOTES = 600

const dims = (d: Dims, unit: Unit) =>
  `${formatLength(d.w, unit)} × ${formatLength(d.d, unit)} × ${formatLength(d.h, unit)}`

const LEG_TEXT = { none: "none", dowel: "dowels", tapered: "tapered plywood corners" } as const

export function requestSubject(args: Pick<RequestArgs, "exterior" | "unit" | "contact">): string {
  const who = args.contact.name.trim()
  return `Cut kit request: plywood box ${dims(args.exterior, args.unit)}${who ? ` (${who})` : ""}`
}

export function requestBody(args: RequestArgs): string {
  const { inputs: i, unit, contact } = args
  const lines = [
    "Hi Will,",
    "",
    "I'd like a cut kit for this box: parts cut to size, Domino joints, pilot holes, packed and shipped.",
    "",
    `Name: ${contact.name.trim() || "(not given)"}`,
    `Reply to: ${contact.email.trim() || "(not given)"}`,
    `Ship to ZIP / postcode: ${contact.zip.trim() || "(not given)"}`,
    "",
    "THE DESIGN",
    `Outside (W × D × H): ${dims(args.exterior, unit)}`,
    `Inside (W × D × H): ${dims(args.interior, unit)}`,
    `Plywood: ${formatLength(i.thickness, unit)} thick`,
    `Lid: ${i.lidPosition}, ${i.lidType}, hinged on the ${i.hingeSide} side`,
    `Bottom: ${i.bottomStyle === "lap" ? "under the walls" : "between the walls"}`,
    `Dividers: ${i.dividers}`,
    `Legs: ${LEG_TEXT[i.legs.style]}`,
  ]
  if (args.estimate) {
    lines.push("", `Estimate shown on the site: ${args.estimate.total}${args.estimate.example ? " (example prices)" : ""}`)
  }
  lines.push("", "Open this exact design:", args.link)
  const notes = contact.notes.trim().slice(0, MAX_NOTES)
  if (notes) lines.push("", "NOTES", notes)
  return lines.join("\n")
}

/** A mailto: URL, or null when there's no address to send to. */
export function requestMailto(email: string, args: RequestArgs): string | null {
  const to = email.trim()
  if (!to) return null
  return `mailto:${to}?subject=${encodeURIComponent(requestSubject(args))}&body=${encodeURIComponent(requestBody(args))}`
}
