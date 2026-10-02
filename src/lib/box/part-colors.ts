import type { PartType } from "./types"

/**
 * Colours for the 3D view and its legend, by part type. WebGL materials can't
 * read CSS tokens, so these live here as HSL strings (the one deliberate
 * exception to "tokens only"). Chosen to stay distinct in light and dark.
 */
export const PART_COLORS: Record<PartType, string> = {
  side: "hsl(210, 60%, 56%)",
  front: "hsl(150, 45%, 46%)",
  back: "hsl(180, 42%, 40%)",
  top: "hsl(265, 48%, 62%)",
  bottom: "hsl(46, 78%, 55%)",
  lid: "hsl(24, 92%, 56%)",
  leg: "hsl(20, 28%, 42%)",
}

export const PART_TYPE_LABEL: Record<PartType, string> = {
  side: "Sides",
  front: "Front",
  back: "Back",
  top: "Top",
  bottom: "Bottom",
  lid: "Lid",
  leg: "Legs",
}

/** Hinge edge indicator. */
export const HINGE_COLOR = "hsl(350, 85%, 48%)"
