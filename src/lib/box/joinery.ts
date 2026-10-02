import type { Axis, Box, BottomStyle, Dims, JoineryId, LidPosition, PartType } from "./types"

/**
 * Joinery decides how the carcass panels meet, and therefore (a) where each
 * panel sits and (b) how much of the exterior the walls consume. Adding rabbet
 * or dado joinery means adding another entry to JOINERY that returns different
 * panel boxes; the part builder, lid, legs, and everything downstream are
 * unchanged.
 */

export type PanelKey = "left" | "right" | "front" | "back" | "top" | "bottom"

export interface Panel {
  key: PanelKey
  name: string
  type: PartType
  box: Box
  /** Axis along which the panel is `thickness` thick. */
  thicknessAxis: Axis
}

export interface JoineryLayout {
  /** Fixed carcass panels. The lid face has no carcass panel. */
  carcass: Panel[]
  /** The overlay slab the lid occupies; lid.ts splits it per lid type. */
  lidSlab: Box
}

export interface Joinery {
  id: JoineryId
  label: string
  /** Interior (usable space) for a given exterior and thickness. */
  interiorFromExterior(ext: Dims, t: number): Dims
  /** Exterior needed to enclose a given interior. */
  exteriorFromInterior(interior: Dims, t: number): Dims
  /** The usable space inside the walls (dividers live here). */
  interiorBox(ext: Dims, t: number): Box
  layout(ext: Dims, t: number, lid: LidPosition, bottom: BottomStyle): JoineryLayout
}

const box = (min: [number, number, number], max: [number, number, number]): Box => ({ min, max })

/**
 * Butt joints. Sides run full height; front/back fit between the sides;
 * top/bottom sit inside the four walls. The lid is an overlay slab on the
 * lid face, so the walls stop one thickness short on that axis.
 * Every dimension loses exactly 2t.
 */
export const buttJoinery: Joinery = {
  id: "butt",
  label: "Butt joints",

  interiorFromExterior: (ext, t) => ({ w: ext.w - 2 * t, d: ext.d - 2 * t, h: ext.h - 2 * t }),
  exteriorFromInterior: (i, t) => ({ w: i.w + 2 * t, d: i.d + 2 * t, h: i.h + 2 * t }),
  interiorBox: ({ w, d, h }, t) => box([t, t, t], [w - t, h - t, d - t]),

  /**
   * Bottom styles:
   *  - "inset": the bottom sits between the four walls, flush with their lower edges.
   *  - "lap":   the bottom spans the full footprint and the walls stand on it,
   *             so the walls bear on the bottom rather than hanging off screws.
   * Either way every dimension still loses exactly 2t inside.
   */
  layout({ w: W, d: D, h: H }, t, lid, bottom) {
    const lap = bottom === "lap"
    // Walls start above the bottom when it laps them.
    const y0 = lap ? t : 0

    const sidePanels = (topY: number, bodyD: number): Panel[] => [
      { key: "left", name: "Side", type: "side", thicknessAxis: 0, box: box([0, y0, 0], [t, topY, bodyD]) },
      { key: "right", name: "Side", type: "side", thicknessAxis: 0, box: box([W - t, y0, 0], [W, topY, bodyD]) },
    ]
    // `bodyD` is the depth of the walls' footprint (a lap bottom matches it).
    // An inset bottom always runs from the back wall to D - t: the front wall
    // (top lid) or the front lid (front lid) occupies the last t either way.
    const bottomPanel = (bodyD: number): Panel => ({
      key: "bottom",
      name: "Bottom",
      type: "bottom",
      thicknessAxis: 1,
      box: lap ? box([0, 0, 0], [W, t, bodyD]) : box([t, 0, t], [W - t, t, D - t]),
    })

    if (lid === "top") {
      const topY = H - t
      return {
        carcass: [
          ...sidePanels(topY, D),
          { key: "back", name: "Back", type: "back", thicknessAxis: 2, box: box([t, y0, 0], [W - t, topY, t]) },
          { key: "front", name: "Front", type: "front", thicknessAxis: 2, box: box([t, y0, D - t], [W - t, topY, D]) },
          // With a top lid the lap bottom spans the whole footprint (depth D).
          bottomPanel(D),
        ],
        lidSlab: box([0, H - t, 0], [W, H, D]),
      }
    }

    const bodyD = D - t
    return {
      carcass: [
        ...sidePanels(H, bodyD),
        { key: "back", name: "Back", type: "back", thicknessAxis: 2, box: box([t, y0, 0], [W - t, H, t]) },
        { key: "top", name: "Top", type: "top", thicknessAxis: 1, box: box([t, H - t, t], [W - t, H, bodyD]) },
        bottomPanel(bodyD),
      ],
      lidSlab: box([0, 0, D - t], [W, H, D]),
    }
  },
}

export const JOINERY: Record<JoineryId, Joinery> = {
  butt: buttJoinery,
}
