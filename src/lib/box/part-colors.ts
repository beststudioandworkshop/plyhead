import type { PartType } from "./types"

/**
 * Colours for the 3D view and its legend, by part type. WebGL materials can't
 * read CSS tokens, so these live here as HSL strings (the one deliberate
 * exception to "tokens only"). Chosen to stay distinct in light and dark.
 */
export const PART_COLORS: Record<PartType, string> = {
  side: "hsl(205, 30%, 50%)",
  front: "hsl(150, 24%, 45%)",
  back: "hsl(262, 20%, 56%)",
  top: "hsl(42, 52%, 54%)",
  bottom: "hsl(345, 30%, 54%)",
  lid: "hsl(24, 88%, 54%)",
  leg: "hsl(24, 30%, 34%)",
  divider: "hsl(188, 30%, 42%)",
}

export const PART_TYPE_LABEL: Record<PartType, string> = {
  side: "Sides",
  front: "Front",
  back: "Back",
  top: "Top",
  bottom: "Bottom",
  lid: "Lid",
  leg: "Legs",
  divider: "Dividers",
}

/** Hinge edge indicator. */
export const HINGE_COLOR = "hsl(350, 85%, 48%)"
