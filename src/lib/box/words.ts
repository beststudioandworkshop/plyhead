import type { LidPosition, PartType } from "./types"
import { PART_TYPE_LABEL } from "./part-colors"

/**
 * Plain-language names that follow the box: a lid on the top, a door on the
 * front, and dividers that become shelves in a box with a door.
 */
export const lidWord = (position: LidPosition) => (position === "front" ? "door" : "lid")
export const dividerWord = (position: LidPosition) => (position === "front" ? "shelf" : "divider")
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Legend / label for a part type in a box with the lid on this side. */
export function partTypeLabel(type: PartType, position: LidPosition): string {
  if (position === "front") {
    if (type === "lid") return "Door"
    if (type === "divider") return "Shelves"
  }
  return PART_TYPE_LABEL[type]
}
