# Zvelclaw Vercel Deployment

This directory stores the GitHub-side deployment metadata for the Zvelclaw Vercel deployment.

## Files

- `deployment.json` — canonical deployment manifest for the Vercel project configuration used by this repository.

## Deployment target

- Platform: Vercel
- Project: `zvelclaw`
- Repository: `Velclaw/zvelclaw-agent`
- Branch: `main`
- Framework: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: `.next`
- Intended production domain: `zvelclaw.vercel.app`

## Important

This manifest is repository documentation/configuration metadata. Vercel does not automatically treat files under `Project/Deployment/vercel/` as its root deployment configuration.

The active Vercel configuration remains the root-level `vercel.json` in the repository. A Vercel project/deployment must also exist on the Vercel platform for `zvelclaw.vercel.app` to resolve.
