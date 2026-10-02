import type { PartType } from "./types"

/**
 * Colours for the 3D view and its legend, by part type. WebGL materials can't
 * read CSS tokens, so these live here as hex values (the one deliberate
 * exception to "tokens only"). The palette: tangerine, sky, tea, lavender,
 * mustard, pink quartz, red passion and muted black, with seashell as the
 * shared stripe colour.
 */
export const PART_COLORS: Record<PartType, string> = {
  lid: "#ED773C", // tangerine
  side: "#9ED6DF", // sky
  front: "#245E55", // tea
  back: "#808BC5", // lavender
  top: "#EAC119", // mustard yellow
  bottom: "#EAA7C7", // pink quartz
  leg: "#C63F3E", // red passion
  divider: "#1D1D1B", // muted black
}

/**
 * The 3D hatch is each part's own colour with a thin diagonal pinstripe in this
 * one colour that every part shares (seashell).
 */
export const UNIVERSAL_COLOR = "#EAE4DA"

/** Base tones for the generic plywood-grain look. Each part is tinted a little toward its own colour. */
export const GRAIN_LIGHT = "#D9B98A"
export const GRAIN_DARK = "#B98D58"

/** A small CSS swatch with the same hatch the 3D view uses (for legends). */
export const hatchSwatch = (color: string) =>
  `repeating-linear-gradient(-45deg, ${color} 0 5px, ${UNIVERSAL_COLOR} 5px 6px)`

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

/** Hinge edge indicator (muted black). */
export const HINGE_COLOR = "#1D1D1B"
