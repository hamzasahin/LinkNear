# Deploy LinkNear to Vercel

**Date:** 2026-04-04
**Status:** Approved — ready for implementation
**Supersedes:** GitHub Pages deployment (sunset)

## Goal

Move LinkNear from GitHub Pages to Vercel as the sole production host. Get clean URLs, simpler OAuth redirect handling, and a deploy workflow driven by the Vercel CLI.

## Context

LinkNear is a static Vite SPA (React 19 + TS + Tailwind v4) that talks directly to Supabase. There is no backend server, no SSR, no serverless functions. The repo was originally set up for GitHub Pages at the `/linknear/` subpath, which forced three non-obvious choices that all have to be undone together:

1. `vite.config.ts` sets `base: '/linknear/'` so asset URLs work under the subpath.
2. `src/App.tsx` uses `HashRouter` because GitHub Pages cannot serve a client-side `BrowserRouter` without 404 fallback config.
3. `src/contexts/AuthContext.tsx` builds the Google OAuth `redirectTo` from `window.location.origin + import.meta.env.BASE_URL`, relying on `BASE_URL === '/linknear/'`.

Vercel serves SPAs at the root domain and handles client-side routing via a rewrite rule in `vercel.json`. All three coupling points can be flattened.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Replace or parallel-run GH Pages | **Replace (sunset GH Pages)** | Single source of truth; avoids env-based config complexity |
| Router mode | **`BrowserRouter`** | Clean URLs, shareable links, standard SPA behavior |
| Project name | **`linknear`** (Vercel default) | No custom domain requested |
| Custom domain | **Not now** | Deploy to `*.vercel.app` first, add domain later |
| Supabase OAuth URL update | **Post-deploy, manual** | User performs in Supabase dashboard after first deploy reveals URL |

## Architecture

Same architecture as today: the browser fetches a static `dist/` bundle from Vercel's edge, then the client makes direct Supabase calls for auth, Postgres, storage, and RPCs. Vercel contributes exactly two things:
- **Edge hosting + HTTPS** for `dist/`.
- **SPA rewrite rule** so that any path (`/discover`, `/connections`, `/profile/abc`) serves `index.html`, letting React Router handle the route client-side.

No functions, no middleware, no ISR, no env-specific code branches.

## File Changes

### 1. `vite.config.ts`
Remove the `base` option. Default root `/` is correct for Vercel.

```diff
  export default defineConfig({
    plugins: [react(), tailwindcss()],
-   base: '/linknear/',
  })
```

### 2. `src/App.tsx`
Swap `HashRouter` for `BrowserRouter`.

```diff
- import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
+ import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
  ...
-   <HashRouter>
+   <BrowserRouter>
      <Routes>...</Routes>
-   </HashRouter>
+   </BrowserRouter>
```

### 3. `src/contexts/AuthContext.tsx`
Simplify the OAuth redirect. With `base: '/'`, `import.meta.env.BASE_URL === '/'` — the old line still works, but we make it explicit to kill the now-obsolete dependency on `BASE_URL`.

```diff
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
-       redirectTo: window.location.origin + import.meta.env.BASE_URL,
+       redirectTo: window.location.origin + '/',
      },
    })
```

### 4. `package.json`
Remove the GH Pages deploy script. `gh-pages` is only invoked via `npx` (not a dependency), so nothing to uninstall.

```diff
    "preview": "vite preview",
-   "deploy": "vite build && npx gh-pages -d dist"
  }
```

### 5. `vercel.json` (new file)
Single SPA rewrite rule. Nothing else — no headers, no caching overrides, no build settings (Vercel auto-detects Vite).

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Note: Vercel's Vite preset auto-sets build command (`npm run build`), output directory (`dist`), and install command. We do not override.

## Environment Variables

Both are required at runtime and read in `src/lib/supabase.ts`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Source of truth: `.env.local` (gitignored, exists today). Target: Vercel project env var store, set for **Production**, **Preview**, and **Development** scopes so `vercel dev` and preview deploys also work.

Command pattern (run from repo root with the project linked):
```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_URL development
# repeat for VITE_SUPABASE_ANON_KEY
```

## Deployment Sequence

1. **Pre-flight local verification**
   - Apply all five file changes.
   - Run `npm run build`. Must succeed (`tsc -b` + vite build). If it fails, fix before deploying.

2. **Vercel project link**
   - `vercel link` in repo root → create new project named `linknear` under the user's default scope.

3. **Env var injection**
   - Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`.
   - Add each to all three Vercel scopes (production, preview, development).

4. **First production deploy**
   - `vercel --prod`.
   - Capture the returned URL (e.g., `https://linknear.vercel.app`).

5. **Post-deploy Supabase update (manual, user-side)**
   - Surface the exact URLs to paste into Supabase → Authentication → URL Configuration:
     - **Site URL**: `https://linknear.vercel.app`
     - **Redirect URLs**: `https://linknear.vercel.app/**` (and keep any existing GH Pages entries if still needed during transition, remove later).
   - Also: in Google Cloud Console → OAuth 2.0 client, ensure the Supabase auth callback URL is already authorized (it should be — Supabase handles the Google → Supabase hop, the Vercel URL only matters for the Supabase → app hop).

6. **Smoke test**
   - Visit the Vercel URL.
   - Landing page loads.
   - Click Google sign-in → complete flow → lands back at `/discover` (or `/onboarding` if new profile).
   - Browser-refresh `/discover` directly — should serve `index.html` (not 404).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Build fails due to router type import change | Low | `BrowserRouter` has identical API surface to `HashRouter` for the usage in `App.tsx`; `npm run build` pre-flight catches it |
| 404 on hard-refresh of deep routes | Medium if rewrite missing | `vercel.json` rewrite rule |
| Google OAuth rejects the new redirect URL | High (expected) | Explicit post-deploy step to update Supabase; user is warned |
| Stale GH Pages deployment confuses users | Low | Out of scope — user can unpublish from repo settings later. Deploy script removed so we don't accidentally re-publish. |
| Vercel auto-detects wrong framework preset | Very low | Vercel's Vite detection is reliable; if needed, `vercel.json` can pin `framework: "vite"` |

## Rollback

- **Code:** `git revert` the config commit. No migrations, no external state changes.
- **Vercel:** `vercel rollback` to previous deployment, or delete the project.
- **Supabase:** Remove the Vercel URL from redirect URLs (only if we added it).

## Out of Scope

- Custom domain setup
- Preview deploy branch protection rules
- Analytics, Speed Insights, or other Vercel paid features
- Removing the `dist/` directory from git history (it was only local to GH Pages flow)
- Taking down the GH Pages site (user-side, later)
- Any schema, RLS, or Supabase function changes

## Success Criteria

1. `npm run build` passes locally after edits.
2. `vercel --prod` returns a live URL.
3. Visiting the URL loads the landing page with no console errors.
4. After the user updates Supabase redirect URLs, Google sign-in succeeds end-to-end and lands on `/discover` or `/onboarding`.
5. Hard-refreshing `/discover` returns the app, not a 404.
