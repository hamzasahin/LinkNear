# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — Type-check (`tsc -b`) then production build. Use this to verify TypeScript; there is no separate `typecheck` script.
- `npm run lint` — ESLint across the repo
- `npm run preview` — Serve the built `dist/` locally
- `npm run deploy` — Build and publish `dist/` to GitHub Pages via `gh-pages`

There is **no test framework** configured in this repo — do not assume `npm test` exists.

## Required environment

Create `.env.local` (gitignored) with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Both are read in `src/lib/supabase.ts` and are required at runtime — the app will fail to initialize without them.

## Architecture

LinkNear is a **static SPA** (React 19 + TS + Vite + Tailwind v4) that talks directly to **Supabase** (Auth, Postgres, Storage). There is no backend server, no SSR, and no serverless functions — every feature is either a direct Supabase client call or an RPC to a Postgres function.

### Deployment constraints (GitHub Pages)

Two things are load-bearing and must not be changed casually:

1. **`vite.config.ts` sets `base: '/linknear/'`** — all asset URLs are prefixed with this. The OAuth redirect in `AuthContext.signInWithGoogle` relies on `import.meta.env.BASE_URL` to land back on the correct subpath.
2. **`App.tsx` uses `HashRouter`** (URLs look like `/#/discover`). This is required because GitHub Pages cannot serve a client-side `BrowserRouter` without 404 fallback config. Do not switch to `BrowserRouter`.

### Auth + profile bootstrap

`src/contexts/AuthContext.tsx` wraps the app and does two jobs:
- Tracks Supabase session via `onAuthStateChange`.
- **Auto-creates a row in `profiles`** on first sign-in (checks by `id`, inserts with name/avatar from Google metadata). New code that reads a profile should assume the row exists post-auth but may be near-empty (`skills: []`, `looking_for: 'networking'`, no location).

Routing in `App.tsx` enforces a two-stage gate:
- `OnboardingRoute` — requires auth only. Used for `/onboarding`.
- `ProtectedRoute` — requires auth **and** a profile with non-empty `skills`; otherwise redirects to `/onboarding`. Onboarding completion is inferred from `skills.length > 0`, not a separate flag. Keep that invariant if you add new onboarding fields.

### Data layer

All Supabase access lives in hooks under `src/hooks/` — there is no abstraction layer or service directory. Pages compose these hooks directly:

- `useProfile` — plain object (not a React state hook); returns CRUD helpers (`getProfile`, `getMyProfile`, `updateProfile`, `uploadAvatar`). `updateProfile` uses `upsert` keyed on `auth.uid()` and always stamps `updated_at`.
- `useDiscover` — calls the `get_nearby_profiles` Postgres RPC (see `supabase/schema.sql`) which uses the `earthdistance`/`cube` extensions to filter by radius. Client then enriches each result with a match score via `utils/matchScore.ts`.
- `useConnections` — manages the `connections` table. `getConnectionStatus(otherUserId)` derives one of `'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'` from the locally cached list, so callers must `getConnections()` first for it to return anything other than `'none'`.
- `useLocation` — browser `navigator.geolocation` + Nominatim reverse-geocode (`nominatim.openstreetmap.org`, a public API, rate-limited). Falls back to coordinates if the fetch fails.

### Proximity / match scoring

- **Distance filtering** happens in Postgres via `get_nearby_profiles(user_lat, user_lng, radius_km, current_user_id)` in `supabase/schema.sql`. Results are ordered by `distance_km` and exclude the caller. Any change to nearby-query semantics must be made in the SQL function, not the client.
- **Match scoring** is client-side in `src/utils/matchScore.ts`, max 100: shared skills (≤40) + shared interests (≤35) + same `looking_for` (15) + `is_online` (10). Skills/interests are compared case-insensitively.

### Database schema (`supabase/schema.sql`)

Two tables plus one RPC. **RLS is enabled** on both:
- `profiles` — public SELECT, self-only INSERT/UPDATE (keyed on `auth.uid() = id`).
- `connections` — SELECT visible to sender or receiver; INSERT restricted to sender; UPDATE restricted to receiver (so only the receiver can accept/decline). A `UNIQUE(sender_id, receiver_id)` constraint prevents duplicate requests in one direction, but **not** in the reverse direction — code that sends invites should check existing state first if you want to avoid cross-requests.

When modifying the schema, update both `supabase/schema.sql` and the corresponding TypeScript types in `src/types/index.ts`. There is no generated types pipeline.

### Styling

- Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is in CSS).
- Theme is a **dark-only palette driven by CSS variables** declared in `src/index.css` (`--bg-primary`, `--accent-primary`, etc.). Components reference them as `bg-[var(--bg-surface)]` rather than Tailwind color utilities. Keep new components consistent with this pattern so theme tokens stay in one place.
- Custom fonts (`DM Sans`, `Instrument Serif`, `JetBrains Mono`) load from Google Fonts in `index.css`; `.font-display` and `.font-mono` are the utility classes.
