import type { Axis, Box, Dims, JoineryId, LidPosition, PartType } from "./types"

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
  layout(ext: Dims, t: number, lid: LidPosition): JoineryLayout
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

  layout({ w: W, d: D, h: H }, t, lid) {
    const sidePanels = (bodyH: number, bodyD: number): Panel[] => [
      { key: "left", name: "Side", type: "side", thicknessAxis: 0, box: box([0, 0, 0], [t, bodyH, bodyD]) },
      { key: "right", name: "Side", type: "side", thicknessAxis: 0, box: box([W - t, 0, 0], [W, bodyH, bodyD]) },
    ]

    if (lid === "top") {
      const bodyH = H - t
      return {
        carcass: [
          ...sidePanels(bodyH, D),
          { key: "back", name: "Back", type: "back", thicknessAxis: 2, box: box([t, 0, 0], [W - t, bodyH, t]) },
          { key: "front", name: "Front", type: "front", thicknessAxis: 2, box: box([t, 0, D - t], [W - t, bodyH, D]) },
          { key: "bottom", name: "Bottom", type: "bottom", thicknessAxis: 1, box: box([t, 0, t], [W - t, t, D - t]) },
        ],
        lidSlab: box([0, H - t, 0], [W, H, D]),
      }
    }

    const bodyD = D - t
    return {
      carcass: [
        ...sidePanels(H, bodyD),
        { key: "back", name: "Back", type: "back", thicknessAxis: 2, box: box([t, 0, 0], [W - t, H, t]) },
        { key: "top", name: "Top", type: "top", thicknessAxis: 1, box: box([t, H - t, t], [W - t, H, bodyD]) },
        { key: "bottom", name: "Bottom", type: "bottom", thicknessAxis: 1, box: box([t, 0, t], [W - t, t, bodyD]) },
      ],
      lidSlab: box([0, 0, D - t], [W, H, D]),
    }
  },
}

export const JOINERY: Record<JoineryId, Joinery> = {
  butt: buttJoinery,
}
