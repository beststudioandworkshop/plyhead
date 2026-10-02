import { formatLength, inToMm, type Unit } from "@/lib/box"

/**
 * Plain-language pointers shown under the size fields. Edit the wording here.
 * Sizes are written in inches and shown in whichever unit the user picked.
 */
const len = (inches: number, unit: Unit) => formatLength(inToMm(inches), unit)

export const SIZE_HINTS = {
  w: (unit: Unit) =>
    `Fitting this through a door? Interior doors are often about ${len(30, unit)} wide.`,
  d: (unit: Unit) =>
    `A shoe box is about ${len(12, unit)} deep, and a bookshelf is usually ${len(10, unit)} to ${len(12, unit)}.`,
  h: (unit: Unit) =>
    `${len(15, unit)} is really nice to sit on. A coffee table is about ${len(16, unit)} to ${len(18, unit)} tall.`,
} as const
