# Plywood box tool: notes and next up

Where things live:

- `src/lib/box/`: pure geometry (parts, lids, legs, dividers, nesting, DXF). No React.
- `src/components/tools/box/`: the UI. `/tools/box` wires it together.

## Parked for later

- **Finishes** now have a section in the how-to card (paint, water-based poly or hard wax oil, paste wax,
  a word on stain). Still open: a finish choice that tints the 3D view, and per-finish prep steps.
- Rabbet and dado joinery (the joinery layer is built to take them).
- Grain direction (every part already carries a `grain` field).
- Hinge hardware and lid stays.

## Shop settings (Will's to fill in)

- `src/config/shop.ts` holds the shop name, the example prices (`PRICES`), and the cut-kit rates (`KIT_RATES`).
  All numbers there are placeholders. Replace them, then set `placeholderPrices` to `false`.
- Build requests are emailed to `NEXT_PUBLIC_QUOTE_EMAIL` (set it in Vercel, then redeploy). Until it's set, the
  form offers "Copy request" instead.
- The cut kit is: parts cut to size, Domino joints, pilot holes, packed and shipped. Hardware is an optional
  extra (`KIT_INCLUDES_HARDWARE`).

## Cutting plans

`nestParts` returns an ordered list of saw cuts per sheet, each running edge to edge across the panel being cut,
in rip-first, cross-cut-first or best order. The sheet layout card draws them and writes the plan out.
