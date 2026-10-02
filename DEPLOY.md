# Deploying Plyhead on Vercel

Claude can't log in to Vercel, so do this once in the browser.

1. Go to https://vercel.com/new and import the GitHub repo. If Vercel can't see
   it, install the Vercel GitHub App on the organization and grant it access to
   the repo.
2. Leave the build settings alone. Vercel detects Next.js and uses pnpm because
   `pnpm-lock.yaml` is committed. No `vercel.json` is needed.
3. Set the **production branch** to `claude/modest-faraday-v7q6pw` (Settings →
   Environments → Production → Branch Tracking).
4. Deploy. From then on every push to that branch deploys automatically, about
   a minute later.

## Good to know

- Production deployments are public; preview deployments sit behind Vercel's
  login wall. Send stakeholders the production URL.
- `incoming/` (if present) belongs in `.vercelignore` so it is never uploaded.

## Environment variables

- Add them in Vercel under Settings → Environment Variables.
- After adding or changing one, **redeploy** (Deployments → latest → Redeploy);
  it does not apply to existing builds.
- **Never use the `NEXT_PUBLIC_` prefix for a secret.** Anything with that
  prefix ships to every visitor's browser.
- List every variable, with no values, in `.env.example`.

## Custom domain

Connect one later, deliberately. Pointing a live domain at Vercel moves live
traffic.
