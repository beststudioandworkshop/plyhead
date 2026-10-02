import * as React from "react"

import { formatLength, inToMm, type Unit } from "@/lib/box"

/**
 * Plain-language pointers shown under the size fields. Edit the wording here.
 * Sizes are written in inches and shown in whichever unit the user picked.
 * Each field has a pool; one is picked at random per page load.
 */
const len = (inches: number, unit: Unit) => formatLength(inToMm(inches), unit)

type Hint = (unit: Unit) => string

export const SIZE_HINTS: { w: Hint[]; d: Hint[]; h: Hint[] } = {
  w: [
    (u) => `Fitting this through a door? Interior doors are often about ${len(30, u)} wide.`,
    (u) => `A milk crate is about ${len(13, u)} square. Two side by side need about ${len(27, u)} inside.`,
    (u) => `Plywood comes in ${len(48, u)} wide sheets, so parts under that are easy to cut.`,
    (u) => `A kitchen cabinet is usually ${len(12, u)} to ${len(36, u)} wide.`,
    (u) => `Making a seat for two? Allow about ${len(18, u)} of width per person, and add a cushion.`,
  ],
  d: [
    (u) => `A shoe box is about ${len(12, u)} deep, and a bookshelf is usually ${len(10, u)} to ${len(12, u)}.`,
    (u) => `A milk crate is about ${len(13, u)} front to back, so ${len(14, u)} inside swallows one.`,
    (u) => `Most paperbacks are about ${len(5, u)} deep, and big hardcovers about ${len(9, u)}.`,
    (u) => `A kitchen counter is ${len(24, u)} deep. Anything deeper than your reach gets hard to use.`,
  ],
  h: [
    (u) => `${len(15, u)} is really nice to sit on. A coffee table is about ${len(16, u)} to ${len(18, u)} tall.`,
    (u) => `A milk crate is about ${len(11, u)} tall, so allow ${len(12, u)} inside to store one.`,
    (u) => `A desk is about ${len(29, u)} high and a kitchen counter about ${len(36, u)}.`,
    (u) => `A step stool is usually ${len(8, u)} to ${len(12, u)} tall.`,
    (u) => `Planning to sit on it? A 2 to 3 inch cushion on a ${len(15, u)} box makes a comfy seat.`,
  ],
}

// One random seed per page load. The server always renders seed 0, then the
// client switches to the random one, so there's no hydration mismatch.
const CLIENT_SEED = Math.floor(Math.random() * 1_000_000)
const subscribe = () => () => {}

export function useTipSeed(): number {
  return React.useSyncExternalStore(subscribe, () => CLIENT_SEED, () => 0)
}

/** The hint for a field. Each field is offset so the three don't change in lockstep. */
export function pickHint(pool: Hint[], seed: number, offset: number, unit: Unit): string {
  return pool[(seed + offset) % pool.length](unit)
}
