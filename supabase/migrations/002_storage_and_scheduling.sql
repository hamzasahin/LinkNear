-- =============================================================================
-- 002_storage_and_scheduling.sql
-- =============================================================================
-- Purpose:
--   1. Provision the `avatars` storage bucket with a 5 MB cap and image-only
--      MIME allowlist.
--   2. Install the RLS policies for storage.objects so users can read anything
--      in `avatars` but only write/update/delete files under their own
--      `<auth.uid()>/...` folder.
--   3. Enable pg_cron + pg_net and schedule the daily purge-deleted-accounts
--      edge function so soft-deleted profiles are hard-deleted after 30 days.
--
-- Idempotent: safe to re-run. Every DDL statement is guarded with IF NOT
-- EXISTS / ON CONFLICT / DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AVATARS STORAGE BUCKET
-- -----------------------------------------------------------------------------
-- Public bucket (objects are directly viewable by URL once the read policy
-- below allows it). file_size_limit is in bytes: 5 * 1024 * 1024 = 5242880.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. STORAGE RLS POLICIES
-- -----------------------------------------------------------------------------
-- storage.objects has RLS enabled by default on Supabase. We scope every
-- write operation to the uploader's own folder: `<auth.uid()>/filename.ext`.
-- The client code in src/hooks/useProfile.ts constructs upload paths this
-- way — keep that invariant if policies are changed.

DROP POLICY IF EXISTS avatars_read_public    ON storage.objects;
DROP POLICY IF EXISTS avatars_insert_own     ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own     ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own     ON storage.objects;

CREATE POLICY avatars_read_public ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 3. SCHEDULED JOB EXTENSIONS
-- -----------------------------------------------------------------------------
-- pg_cron schedules SQL statements; pg_net lets those statements fire HTTP
-- requests so we can invoke the deployed edge function. Both ship with
-- Supabase Postgres but must be explicitly installed per project.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- -----------------------------------------------------------------------------
-- 4. DAILY PURGE SCHEDULE
-- -----------------------------------------------------------------------------
-- Unschedule any prior version of this job before re-creating it so this
-- migration is safe to re-apply.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-accounts-daily') THEN
    PERFORM cron.unschedule('purge-deleted-accounts-daily');
  END IF;
END $$;

-- The edge function itself uses the service role key (auto-injected by
-- Supabase) to call auth.admin.deleteUser. The Authorization header below
-- only satisfies the edge function gateway's JWT verification — the anon
-- key is a public JWT (it is also shipped in the browser bundle via
-- VITE_SUPABASE_ANON_KEY) so committing it here is not a secret leak.
--
-- Runs every day at 03:00 UTC.
SELECT cron.schedule(
  'purge-deleted-accounts-daily',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://gfgqfevkbxmlrghdefmk.functions.supabase.co/purge-deleted-accounts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZ3FmZXZrYnhtbHJnaGRlZm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzUxOTMsImV4cCI6MjA5MDkxMTE5M30.gFbH6eWTGvs5m4zv9kT39EoCejy1BKe9ej_CDHh0ohs',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- -----------------------------------------------------------------------------
-- 5. POST-APPLY SANITY CHECK (prints to psql NOTICE stream during push)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_bucket_limit    BIGINT;
  v_policy_count    INT;
  v_cron_exists     BOOLEAN;
BEGIN
  SELECT file_size_limit
    INTO v_bucket_limit
    FROM storage.buckets
    WHERE id = 'avatars';

  SELECT COUNT(*)
    INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname LIKE 'avatars_%';

  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-accounts-daily')
    INTO v_cron_exists;

  RAISE NOTICE '[002_storage_and_scheduling] avatars file_size_limit=% bytes, avatars_* policies=%, cron scheduled=%',
    v_bucket_limit, v_policy_count, v_cron_exists;

  IF v_bucket_limit IS DISTINCT FROM 5242880 THEN
    RAISE EXCEPTION 'avatars bucket file_size_limit expected 5242880, got %', v_bucket_limit;
  END IF;
  IF v_policy_count <> 4 THEN
    RAISE EXCEPTION 'expected 4 avatars_* policies on storage.objects, got %', v_policy_count;
  END IF;
  IF NOT v_cron_exists THEN
    RAISE EXCEPTION 'purge-deleted-accounts-daily cron job was not scheduled';
  END IF;
END $$;
