import { screwAdvice } from "./screws"
import { formatLength } from "./units"
import type { BoxInputs, BoxResult, Unit } from "./types"

/**
 * Tools that make the build easier. Not hardware to buy for the box itself
 * (see hardware.ts) but things to have on the bench. Essentials first.
 */

export interface ToolItem {
  id: string
  name: string
  /** Why it helps, in a sentence. */
  why: string
  essential: boolean
}

export function toolsList(inputs: BoxInputs, result: BoxResult, unit: Unit): ToolItem[] {
  if (!result.ok) return []
  const t = inputs.thickness
  const pilot = formatLength(screwAdvice(t).pilotMm, unit)
  const items: ToolItem[] = []
  const add = (item: ToolItem) => items.push(item)

  add({
    id: "saw",
    name: "Table saw, track saw or circular saw with a guide",
    why: "For the cuts in the cutting plan. A track saw or a circular saw on a straightedge is the easiest way to break a full sheet down.",
    essential: true,
  })
  add({
    id: "support",
    name: "Sawhorses and a sheet of foam board (or a sacrificial surface)",
    why: "Supports the sheet on both sides of the cut so the offcut can't pinch the blade, and protects your floor.",
    essential: true,
  })
  add({
    id: "measure",
    name: "Tape measure, combination square and pencil",
    why: "To mark each cut from the plan and check every corner is square before the glue sets.",
    essential: true,
  })
  add({
    id: "drill",
    name: "Drill / driver",
    why: `With a ${pilot} pilot bit and a countersink. Pilot holes in plywood edges stop the layers splitting, and countersinks sit the heads flush.`,
    essential: true,
  })
  add({
    id: "clamps",
    name: "Clamps (at least four)",
    why: "Hold the joints tight while the glue grabs. Bar or pipe clamps, or ratcheting bar clamps, all work.",
    essential: true,
  })
  add({
    id: "sanding",
    name: "Sanding block or random-orbit sander, 120 and 220 grit",
    why: "Sand the faces and ease the edges before finishing. Plywood edges need the most.",
    essential: true,
  })
  add({
    id: "rag",
    name: "Damp rag",
    why: "Wipe glue squeeze-out right away. Dried glue blocks finish.",
    essential: true,
  })
  add({
    id: "safety",
    name: "Eye and ear protection, and a dust mask",
    why: "Plywood dust is fine and the saw is loud.",
    essential: true,
  })

  add({
    id: "domino",
    name: "Domino or biscuit joiner",
    why: "Optional. Floating tenons line the panels up and add strength to the butt joints.",
    essential: false,
  })
  add({
    id: "router",
    name: "Router with a round-over bit",
    why: "Optional. Softens the edges, which also helps a finish wear well and is kinder to anyone sitting on it.",
    essential: false,
  })
  add({
    id: "chisel",
    name: "Sharp chisel",
    why: "Optional. For lightly mortising the hinges so the lid closes flush.",
    essential: false,
  })
  if (inputs.legs.style === "dowel") {
    add({
      id: "dowel-ends",
      name: "Block plane or sandpaper for the dowel ends",
      why: "Optional. Round over the bottoms of the dowels so they don't splinter on the floor.",
      essential: false,
    })
  }
  if (inputs.legs.style === "tapered") {
    add({
      id: "leg-clamps",
      name: "A few extra clamps or a corner clamp",
      why: "Optional. Holding each pair of leg plates square while the glue sets is fiddly.",
      essential: false,
    })
  }

  return items
}
