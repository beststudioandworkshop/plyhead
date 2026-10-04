# Handoff: building a bike-frame geometry tool like the Plyhead box tool

This is a briefing for a fresh Claude Code chat. It describes everything built so far
in the Plyhead repo (a parametric plywood-box tool for makers), how it was built, what
worked, what bit us, and how to apply the same approach to a **custom bike frame
geometry tool**. Read it all before writing code.

The owner is Will Reynolds (shop name: "Wire"). He is a maker, not a developer. He
reviews each step in a browser and gives short, plain-spoken feedback.

- **Reference repo:** `beststudioandworkshop/plyhead` (private). Ask Claude to add it to
  the session if you want to read real code. Live site is on Vercel.
- **Reference tool:** `/tools/box` in that repo.

---

## 1. What the box tool is (the thing to imitate)

A web tool where someone configures a plywood box, sees it update live in 3D, and gets
everything they need to build it. Audience: hobbyists with a table saw, track saw,
circular saw or a CNC. It runs entirely in the browser (no backend).

**Inputs**
- Units (inches with 1/16" fractions, or mm).
- Outside size, or "fit inside" size plus clearance (the outside is worked out).
- Plywood thickness presets (real thicknesses) or custom.
- Opening: top or front. Lid/door type: full, split, half, or none (open).
- Hinge side (long/short edge), which half opens.
- Bottom panel between the walls or lapped under them (so walls bear on it).
- Dividers (shelves in a box with a door), up to 3.
- Legs: none, dowels, or tapered plywood corner pairs.
- Cut-size rounding ("keep exact" vs "make it easier": nearest 1/8" or 1 mm).
- Sheet size (4x8 or 5x5), saw kerf, and the first-cut direction (best / rip / cross).

**Outputs (all generated from one parts list)**
1. Live 3D preview: orbit, exploded view, open the lid/door on its hinge, surface looks
   (solid, hatch, plywood grain with visible plies), legend, hinge indicator.
2. Cut list (grouped, copy to clipboard, CSV download).
3. Sheet layout: guillotine nesting with kerf, yield, and an ordered **saw cutting plan**
   (every cut runs edge to edge, drawn as numbered dashed lines).
4. DXF export, one layer per part type (Maker.js).
5. Hardware and supplies list, tools list, how-to guidance (screws, glue, order of
   assembly, finishes, a cushion tip).
6. Shareable link that reopens the exact design.
7. Built but **switched off**: pricing estimates and a "request a cut kit" email flow.

Stack: Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui on **Base UI**,
React Three Fiber + drei, Maker.js, Vitest, pnpm.

---

## 2. The most important idea: one pure geometry module

> Everything is generated from a single parts list produced by a pure,
> framework-free module. The 3D view, cut list, nesting, DXF, hardware list and share
> link all read that list. Nothing else computes geometry.

`src/lib/box/` is plain TypeScript with **no React and no Three imports**. It is fully
unit tested (about 2000 tests across 23 test files). The UI only wires inputs to it and
renders the results. This is why changes stayed safe even when features were added
quickly: change the module, fix the failing tests, then the UI follows.

The core contract:

```ts
buildBox(inputs: BoxInputs): BoxResult
// BoxResult = { ok, issues[], exterior, interior, parts: Part[], bounds }

interface Part {
  id: string; name: string; type: PartType        // type drives colour, legend, DXF layer
  length: number; width: number; thickness: number // the cut size (mm)
  center: Vec3; rotation: Vec3; extents: Vec3      // world placement
  shape: "box" | "cylinder" | "polygon"
  outline?: [number, number][]                     // polygon parts, in the part's local frame
  hinge?: { edge; from: Vec3; to: Vec3 }           // line the part swings about
  grain: "length" | "width" | null                 // reserved
}
```

Conventions worth copying:
- **Millimetres internally**; convert only for display. A units module parses input
  like `1 1/2"`, `3/4`, `25mm` and formats to 1/16" fractions.
- World frame matches Three.js (Y up). Parts are axis-aligned boxes with an Euler
  rotation; renderers can use `extents` and skip rotating.
- **Validation returns issues, never throws**: `{ code, message, field }`. If any exist,
  `ok` is false and `parts` is empty, and the UI shows the messages.
- Anything that is a *choice* rather than a calculation lives in a constants file
  (clearance default, kerf default, thickness presets, hinge rules).
- **Joinery is a strategy** (`joinery.ts`): the layout function decides where panels sit,
  so rabbets/dados can be added later without touching the rest.
- Naming follows the object (a front lid is a "door", its dividers are "shelves") via a
  tiny `words.ts`; ids and types stay stable underneath.

### File map (reference)

```
src/lib/box/                pure module (no React)
  types.ts constants.ts units.ts          shared types, choices, unit parse/format
  build.ts joinery.ts lid.ts dividers.ts legs.ts part.ts rotation.ts   geometry
  cutlist.ts rounding.ts nesting.ts dxf.ts                             outputs
  hardware.ts screws.ts tools-list.ts plywood.ts estimate.ts request.ts  guidance/commerce
  explode.ts open.ts part-colors.ts words.ts                           view maths
  share.ts                                                             link encode/decode
  index.ts                                                             public exports
src/components/tools/box/   UI only
  box-configurator.tsx (state + wiring) controls.tsx dimension-input.tsx choice.tsx
  preview-card.tsx box-scene.tsx (R3F) cut-list.tsx sheet-layout.tsx
  hardware-list.tsx how-to.tsx share-card.tsx order-card.tsx hints.ts
src/app/tools/box/page.tsx  server page: reads ?d= and restores a shared design
src/config/shop.ts          prices, rates, shop email, SHOW_ORDERING switch
docs/                       notes + this file
CLAUDE.md                   house rules for the AI (read it in the repo)
```

---

## 3. How the project was set up

1. Scaffolded with the **Monad** design-system skill
   (https://github.com/doughawk25/Monad-System-Skill): Next 16 + Tailwind v4 + the full
   shadcn kit. The skill is vendored at `.claude/skills/monad`.
2. In the cloud session `ui.shadcn.com` was blocked, so the kit came from the skill's
   bundled `demo/` snapshot. `shadcn add` would need that host allowed.
3. The design-system showcase lives at `/system` (linked from the footer); the public
   site owns `/`. A tools section lives at `/tools`.
4. `CLAUDE.md` holds the house rules. The important ones:
   - Build from the installed kit (`src/components/ui/`), never hand-roll controls.
   - Base UI, not Radix: compose with the `render` prop, never `asChild`.
   - Style with **tokens** (`bg-primary`, `text-muted-foreground`), never hex or raw
     palette steps. (Exception: WebGL materials can't read CSS tokens, so 3D colours
     live in one file, `part-colors.ts`.)
   - Check light and dark, phone and desktop.
   - **Next 16 is not the Next you know**: read `node_modules/next/dist/docs/`.
     Middleware is `proxy.ts`; `searchParams` on a page is a Promise.
   - Forms: react-hook-form + zod with `standardSchemaResolver` (not `zodResolver`).
5. Deploy: Vercel imports the repo; **production branch = the `claude/...` branch**
   Claude works on, so every push deploys in about a minute (see `DEPLOY.md`).
   Production URLs are public, previews sit behind Vercel's login.
6. pnpm needs an `allowBuilds` block in `pnpm-workspace.yaml` so `sharp` builds.
7. Fonts: IBM Plex via `next/font`; beware shadcn's circular `--font-sans` mapping.

---

## 4. Features and the decisions behind them

Design decisions the owner made (keep these in mind; he likes plain language):

- **Interior vs exterior modes.** "Fit inside" adds a total clearance and the wall
  thicknesses; the other direction subtracts them. Round-trip tested.
- **Real plywood thicknesses** (0.47" and 0.71" nominal) plus 12/18 mm.
- **Cut-size rounding** is a stage between the exact geometry and everything the user
  cuts from. The 3D keeps exact parts; cut list, sheet layout and DXF use rounded ones.
- **Screw advice is a fence, not a formula.** Bite is never under 1" nor over 2" (risks
  breaking through the side). Two tiers: good (1" bite, a screw every 8") and better
  (1.5" bite, every 10"). Pilot holes are always 1/8" and countersinking is encouraged.
- **Saw-friendly nesting.** Not just fitting parts on a sheet: every layout comes with an
  ordered cut plan where each cut crosses the whole panel being cut, rip-first or
  cross-cut-first or "best". Stats: sheets, cuts, cut length.
- **Front lid = door; its dividers = shelves**, and horizontal. A split top lid always
  gets a divider under the seam (so only odd counts) so both leaves have support.
- **"None (open)"** for an open top or open front: one thickness less lost inside.
- **Hinge side only moves the hinge**; it must never change how a lid is split.
- **Finishes copy is in the owner's voice** (stain is colour, top coat is the protector,
  "finish" covers both; paste wax, patiently).
- **Pricing is hidden** (`SHOW_ORDERING = false`) until the owner is ready. Placeholder
  prices are clearly labelled as examples. The request flow emails the shop via
  `mailto:` with the design as a link; the address is an env var
  (`NEXT_PUBLIC_QUOTE_EMAIL`), never hard-coded.

UI conventions:
- **Orange "entry" accent**: only the settings panel's inputs, selects and chosen buttons
  are orange (plain, no hatch). It tells people where to put their information.
- **A different palette colour along the top of each card** (a 3px band) as a light
  touch of colour guidance. Palette (from the owner's swatches): tangerine, sky, tea,
  lavender, mustard, pink quartz, red passion, muted black, seashell.
- Small helper hints under size fields, shuffled per page load (door widths, a shoe box,
  milk crates, a comfy seat height). Written in friendly plain language.
- Cards in order: 3D preview, "Your box" sizes, cut list, sheet layout, what you'll need
  (hardware + tools), share/order, how-to.

---

## 5. How the work was run (the process to repeat)

- **Plan first, then steps with a stop after each.** The owner set a build order:
  geometry module + tests -> controls + cut list -> 3D -> nesting + DXF -> styling. He
  reviewed after every step. Do not run ahead.
- **Ask before big decisions; otherwise state your assumption and proceed.** Example: the
  tapered-leg design was a real choice, so it was asked. Smaller calls were made and
  flagged in the summary so he could redirect.
- **Use sub-agents for parallel pure-module work and test writing.** A good pattern: you
  write the core module and its public API, then spawn agents with precise written specs
  to write the tests or a self-contained module (nesting, DXF, share link, hardware
  list). Give them exact function signatures, rules, and edge cases. Tell them not to
  edit non-test files and to *report* real module bugs rather than fix them. This
  caught real bugs (e.g. a front-lid bottom panel one thickness too shallow).
- **Verify in a real browser, always.** Production build, then Playwright screenshots at
  phone and desktop widths in both themes. Many bugs only showed up visually.
- **Check everything before every push**: `pnpm test`, `pnpm typecheck`, `pnpm lint`
  (three known upstream shadcn errors are expected), `pnpm build`. Vercel's build runs
  the type-check over test files too, so a broken test file fails the deploy.
- **Commit and push to the session's `claude/...` branch only**, in small commits with
  clear messages. No pull requests unless asked.
- **Write knowledge into the repo** (`docs/`, `DEPLOY.md`, `LOCAL-SETUP.md`), not just chat.
- **The owner cannot open localhost.** The session runs in a cloud container. Show work
  through the Vercel URL after a push, or through screenshots.
- Report outcomes honestly: say what was and wasn't verified (for example "I only saw the
  3D view in software-rendered headless Chromium, not on a real GPU").

---

## 6. Hard-won lessons and traps

**3D (React Three Fiber)**
- Lazy-load the canvas with `next/dynamic({ ssr: false })`.
- `frameloop="demand"` saves battery, but you must call `invalidate()` while animating.
- **Do not let anything recompile a shader on interaction.** A drei fat `Line` rebuilt its
  material every toggle, and the first few animations stuttered on a real GPU. Fix: use
  a plain thin mesh, and make surface "looks" live **uniforms** on one shared shader
  (`customProgramCacheKey` constant). Measure it: count `compileShader` calls through a
  Playwright init script (target: zero after load).
- three.js colour strings: use `hsl(210, 60%, 56%)` with commas or hex. The space-
  separated CSS form silently renders white.
- Stripe/grain shaders need `fwidth`-based anti-aliasing or they moire at shallow angles.
- Camera: re-fit when the object's bounds change but keep the user's angle; glide rather
  than jump; cancel the glide the moment the user touches the controls.
- Exploded and open views are time-based timelines with per-part staggering and easing;
  the maths lives in the pure module so it is testable.
- Plywood grain is a shader: face veneer rings, and on edges stacked plies with glue
  lines (`plyCount(thickness)` is odd, about one ply per 2.4 mm).

**React / Next**
- Reading `window.location` in render causes hydration mismatches. For share links, the
  server page reads `searchParams` (a Promise in Next 16) and passes an `initial` state.
- A random per-load value (the shuffled hints) must use `useSyncExternalStore` with a
  server snapshot of 0, or hydration breaks.
- The React-compiler lint rules reject mutating values returned from `useState` and
  mutating hook results in effects. Use a class with an `update()` method for three.js
  uniforms, and `getState()` from `useThree` inside effects.
- CSS that must beat the kit's utility classes has to be **outside any `@layer`**.
- Base UI `Select` needs an `items` prop or it shows the raw value instead of the label.
- Base UI `ToggleGroup` is array-valued; ignore the empty array when a selected item is
  clicked again.
- Dimension text inputs: push valid values up as the user types, but only reformat on
  blur so the cursor is not fought.

**Environment**
- Stale servers: after a rebuild, an old `next start` keeps serving old chunk hashes and
  the page 500s. Kill the old `next-server` process before restarting. (Do not use
  `pkill -f` with a pattern that also matches your own shell command.)
- Playwright WebGL in the sandbox needs
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --use-gl=angle`.
- `ui.shadcn.com` and some other hosts are blocked by the egress proxy.
- Vercel framework preset can get saved as "Other" if the project is imported while the
  repo is empty; that serves a platform 404 on a "Ready" deployment. Set it to Next.js.
- Hold a push while sub-agents are mid-edit on tests; a half-updated test file fails the
  type-check and so the deploy.

**Product**
- Hide unfinished commercial features behind a flag rather than deleting them.
- Never invent real prices, addresses or specs. Mark placeholders as examples.
- Safety-sensitive advice (fasteners, joinery) is "rules of thumb" and should say so.

---

## 7. Applying it to a custom bike frame geometry tool

The same architecture should carry over. Everything below is a **suggestion to confirm
with the owner**; I have not verified bike-specific numbers, so check formulas against
a reliable source before relying on them.

### 7.1 Mapping

| Box tool | Bike frame tool |
|---|---|
| Parts list of boards | Parts list of **tubes** (and lugs/dropouts/bosses if modelled) |
| `BoxInputs` | `FrameInputs`: the geometry numbers below |
| `buildBox` | `buildFrame(inputs)` -> key points, tubes, derived metrics, issues |
| Cut list | **Tube schedule**: length, diameter, wall, butting, end miters |
| Sheet nesting + cut plan | Tube cut order, mitre angles, and a **fixture/jig sheet** |
| DXF of flat parts | **1:1 printable drawing** and mitre/cope **paper templates** (PDF or DXF) |
| 3D preview of boards | 3D of tubes (cylinders between joints), exploded/assembly view |
| Hardware + tools lists | Components spec (headset, BB shell, dropouts, etc.) + shop tools list |
| How-to guidance | Building notes (tacking, brazing/welding order, alignment, cooling, checks) |
| Share link | Same: encode the geometry in `?d=` |
| Interior/exterior toggle | Maybe **fit-driven vs numbers-driven** input modes (see below) |

### 7.2 Inputs to consider (confirm which the owner wants)

- Wheel/tyre size (rim diameter + tyre section -> wheel diameter), crank length.
- Seat tube length and angle, top tube (effective) length, head tube length and angle.
- Bottom bracket drop (or height), chainstay length, fork axle-to-crown and offset (rake).
- Stack and reach as an alternative way to specify fit.
- Tube diameters and wall thicknesses per tube, plus the intended material (steel/ti/alu).
- Standover target, handlebar/saddle references if doing fit-driven input.

### 7.3 Derived values to show live (verify formulas!)

Wheelbase, front centre, trail, stack and reach, standover, toe overlap check, bottom
bracket height, seat/head tube extension, top tube slope. A commonly cited trail
relationship is `trail = (R * cos(a) - offset) / sin(a)` where `R` is wheel radius,
`a` is the head tube angle from horizontal, and `offset` is fork rake; confirm it and its
sign conventions before coding. Show a **comparison readout** (for example against
"typical" ranges) as soft guidance, not hard limits.

### 7.4 Architecture to reuse

1. `src/lib/frame/` pure module, no React/Three, **millimetres and degrees internally**.
2. Compute named **key points** first (BB, rear axle, front axle, head tube top/bottom,
   seat tube top, etc.), then derive tubes as segments between points. Tubes become
   `Part`s with `length`, `center`, `rotation`, endpoints, diameter and wall.
3. `issues[]` for impossible geometry (negative lengths, tyre clashes with the seat tube
   or chainstay, fork/head tube overlap, toe overlap warnings).
4. Tests first, exactly like the box: known reference frames with published numbers,
   symmetry, round trips (stack/reach <-> top tube/seat/head), unit conversion, and
   "every tube endpoint touches a joint".
5. 2D side-view drawing is the hero output for frames (an SVG built from the same key
   points, with dimension annotations). The 3D view is secondary but still wanted.
6. Miter/cope maths belongs in the pure module (tube diameter pair + intersection
   angle -> unrolled template outline), and can feed the same DXF export (Maker.js) and
   a print-to-scale PDF.
7. Keep a **share link** and a **hardware/tools/how-to** area, same card layout.

### 7.5 Things to be careful about

- Frames are safety critical. Include clear disclaimers; this is a geometry planner, not
  an engineering analysis. Don't present loads, fatigue or tube-selection as validated.
- Units: bike people mix mm, degrees, and inches (tubing, wheels). Make units explicit
  per field.
- Make the angle and length inputs forgiving (typed values, steppers, sensible limits).

### 7.6 Suggested build order (stop after each)

1. Interview the owner (questions below), then agree the input list and outputs.
2. Pure geometry module + tests (key points, tubes, derived metrics, issues).
3. Controls + readouts + tube schedule (no drawing yet).
4. 2D side-view drawing from the key points.
5. 3D tube preview (reuse the R3F scene patterns: lazy-loaded, demand frameloop, no
   shader recompiles, camera glide).
6. Miter/cope templates and DXF/PDF export.
7. Guidance cards (components, tools, building notes), share link.
8. Styling pass to match the site (palette, card bands, orange entry fields).

### 7.7 Questions to ask the owner first

- Which frame type/material/process (steel TIG/braze, lugged, ti, alu)?
- Fit-driven (stack/reach) or numbers-driven (tube lengths/angles), or both?
- Single geometry or full size run? Compare against a reference bike?
- Must it output jig/fixture settings, miter templates, a bill of tubing?
- Is this in the same repo/site (a new route under `/tools`) or a new project?
- Any hard rules he already uses (BB drop ranges, trail targets, toe overlap policy)?

---

## 8. Copy-paste prompt for the new chat

> I want to build a custom bike frame geometry tool, modelled on the Plyhead plywood box
> tool. Read `docs/handoff-bike-frame-tool.md` fully first. Follow its architecture (one
> pure, tested geometry module that every output reads from), its process (plan, then
> steps with a stop after each, verify in a real browser, check test/typecheck/lint/build
> before every push), and its conventions. Don't build anything until you've asked me the
> questions in section 7.7 and I've agreed the inputs, outputs and build order. Flag
> anything you can't verify, especially bike-specific formulas and numbers.

---

## 9. Quick reference: commands

```bash
pnpm install
pnpm dev                      # fine locally; in the cloud, test with build + start instead
pnpm test                     # vitest, ~2000 tests
pnpm typecheck && pnpm lint   # lint: 3 known upstream shadcn errors are expected
pnpm build && pnpm start      # production check
```

Switches and settings worth knowing: `SHOW_ORDERING` in `src/config/shop.ts` (pricing
and the cut-kit request card), `NEXT_PUBLIC_QUOTE_EMAIL` (where requests go), the example
prices in `src/config/shop.ts` (all placeholders), and `docs/box-tool-notes.md` for
parked ideas.
