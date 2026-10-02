# Running Plyhead locally

```bash
git clone <repo-url> plyhead
cd plyhead
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Check a production build

```bash
pnpm build && pnpm start
```

This is how the work should be verified; `next dev` can behave differently.

## Scripts

| Script           | What it does                          |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Dev server                            |
| `pnpm build`     | Production build                      |
| `pnpm start`     | Serve the production build            |
| `pnpm typecheck` | `tsc --noEmit`                        |
| `pnpm lint`      | ESLint (3 known upstream failures, not a gate: `ui/carousel.tsx`, `hooks/use-mobile.ts`, `theme-toggle.tsx`) |

## pnpm note

`pnpm-workspace.yaml` has an explicit `allowBuilds` block so the install
scripts for `sharp` and `unrs-resolver` run. Don't replace it with pnpm's
default `ignoredBuiltDependencies` list, which silently skips them.

## Environment

Copy `.env.example` to `.env.local` and fill in values. `.env.local` is
git-ignored. Never use `NEXT_PUBLIC_` for secrets.

## Routes

- `/` public site
- `/system` design-system showcase (also `/system/components`,
  `/system/foundations`), linked from the home footer
- `/tools/*` maker tools

## Getting files (photos, documents) to Claude

- Don't send full-resolution images through the chat; they arrive downsized
  (about 1300px wide) and the site looks soft.
- Easiest: upload on GitHub. Open the folder in the repo, choose Add file →
  Upload files, drag the files in, Commit changes. Claude sees them on its next
  pull.
- Many files: allow the photo host (e.g. `dropbox.com`) in the environment's
  network settings and give Claude the share links.
- Keep your own descriptive filenames.
- Confidential files never go in `public/`.
