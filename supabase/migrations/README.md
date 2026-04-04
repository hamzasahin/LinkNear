# LinkNear Database Migrations

Forward-only SQL migrations for the LinkNear Postgres schema.

## How migrations work here

- Migrations are **forward-only** and numbered (`001_`, `002_`, ...).
- Each file is idempotent — safe to re-run.
- `supabase/schema.sql` is the canonical target state for a **fresh** database. It reflects the state after all migrations have been applied.
- Existing deployments should run the numbered migration files in order.

## Running migrations

### On an existing Supabase project

Copy the contents of the migration file into the Supabase SQL editor and run it:

1. Open your Supabase project → **SQL Editor**.
2. Click **New query**.
3. Paste the migration SQL.
4. Run.
5. Confirm success (no errors in the output pane).

### On a fresh Supabase project

Either:

- Run `supabase/schema.sql` once (it is the target state), **or**
- Run the numbered migrations in order.

Both approaches produce the same result.

### Local with the Supabase CLI

```bash
supabase db reset    # wipes and re-applies schema.sql
# or
psql "$DATABASE_URL" -f supabase/migrations/001_production_foundation.sql
```

## Migration 001 — Production Foundation

**What it does:**

- Adds safety columns to `profiles`: `deleted_at`, `discovery_enabled`, `date_of_birth`, `terms_accepted_at`, `onboarding_completed_at`.
- Installs `profiles_normalize` trigger that rounds `lat/lng` to 3 decimals (~100 m) and deduplicates tag arrays on every insert/update.
- Adds `CHECK` constraints for string lengths, array bounds, `looking_for` enum, geo bounds, and age gate (13+).
- Creates gist index for `earth_distance` queries, GIN indexes for `skills`/`interests`/`full_name` (trigram).
- Replaces the broken `UNIQUE(sender_id, receiver_id)` with canonical `(user_lo, user_hi)` generated columns + unique index.
- Creates tables: `messages`, `blocks`, `reports`, `rate_limits`, `storage_cleanup`.
- Rewrites RLS so direct writes on `connections` and `messages` are blocked — clients must go through `SECURITY DEFINER` RPCs.
- Creates RPCs for every mutation, each with per-user rate limiting via `check_rate_limit`.
- **Rewrites `get_nearby_profiles` to no longer return raw `latitude`/`longitude`** — only `distance_km`. Also adds pagination, a `p_looking_for` filter, block-list filtering, and a hard radius cap.
- Creates `get_profile_with_distance(id, lat, lng)` so the client can fetch a profile with a server-computed distance without ever seeing the target's coordinates.

**Expected runtime:** under 5 seconds on a typical Supabase Free project with the hackathon seed data.

**Risk profile:** medium. Destructive changes are limited to: dropping the old broken unique constraint, dropping the old `get_nearby_profiles(...)` signatures, and dropping legacy RLS policies. All other changes are additive.

**Rollback:** this is a forward-only migration. Rolling back requires restoring from a pre-migration backup. Take a database snapshot (`Database` → `Backups` in the Supabase dashboard) before applying in production.

## Post-migration sanity checks

Run in the SQL editor after applying:

```sql
-- 1. All expected constraints exist on profiles
SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass;

-- 2. All new tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'blocks', 'reports', 'rate_limits', 'storage_cleanup');

-- 3. Bidirectional connection uniqueness works
--    Pick two real profile IDs for <a> and <b>. The second insert should raise.
-- INSERT INTO connections (sender_id, receiver_id) VALUES ('<a>', '<b>');
-- INSERT INTO connections (sender_id, receiver_id) VALUES ('<b>', '<a>'); -- must fail

-- 4. The discover RPC no longer returns lat/lng columns
SELECT proargnames, prorettype::regtype
FROM pg_proc WHERE proname = 'get_nearby_profiles';

-- 5. The gist index is used
EXPLAIN ANALYZE SELECT * FROM get_nearby_profiles(37.33, -121.88, 10);
-- Look for 'Index Scan using idx_profiles_location' in the plan.

-- 6. Rate limit trips
-- SELECT check_rate_limit('test', 2, 3600);
-- SELECT check_rate_limit('test', 2, 3600);
-- SELECT check_rate_limit('test', 2, 3600); -- must raise 'rate_limit_exceeded'
```

## Storage bucket policies

Migration 001 does **not** touch Supabase Storage bucket policies because those must be applied via the dashboard or the `storage` schema which is managed separately.

Apply these policies via the Supabase dashboard under **Storage** → **Policies** → **avatars**:

```sql
-- Writable only to the owner's folder
CREATE POLICY avatars_write_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read
CREATE POLICY avatars_read_public ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Delete own only
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Also set the `avatars` bucket max file size to 5 MB via the bucket settings.
