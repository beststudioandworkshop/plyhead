# Plywood box tool: notes and next up

Where things live:

- `src/lib/box/`: pure geometry (parts, lids, legs, dividers, nesting, DXF). No React.
- `src/components/tools/box/`: the UI. `/tools/box` wires it together.

## Parked for later

- **Finishes.** Suggest and explain finishes (oil, poly, paint), including what to do before assembly
  (sand, seal edges) and how finish affects glue-ups. Possibly a finish choice that tints the 3D view.
- Rabbet and dado joinery (the joinery layer is built to take them).
- Grain direction (every part already carries a `grain` field).
- Hinge hardware and lid stays.
