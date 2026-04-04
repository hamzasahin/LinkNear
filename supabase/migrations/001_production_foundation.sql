-- =============================================================================
-- LinkNear Migration 001: Production Foundation
-- =============================================================================
-- Forward-only migration. Idempotent where possible.
-- Transforms the hackathon-MVP schema into a production-ready data layer.
--
-- What this does:
--   1. Adds safety columns (deleted_at, discovery_enabled, date_of_birth, etc.)
--   2. Adds CHECK constraints for lengths, enums, geo bounds, and age gate
--   3. Installs a normalize trigger (rounds lat/lng to ~100m, trims/dedupes tags)
--   4. Creates gist/gin indexes for discovery + search performance
--   5. Replaces broken connection UNIQUE(sender,receiver) with a canonical index
--   6. Creates messages, blocks, reports, rate_limits, storage_cleanup tables
--   7. Rewrites RLS policies with block-aware filtering and tombstone filtering
--   8. Creates SECURITY DEFINER RPCs for all mutations with rate limiting
--   9. Rewrites get_nearby_profiles to strip raw lat/lng from output
--
-- Run against a fresh DB or the existing hackathon DB — either works.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 2. PROFILES: NEW COLUMNS
-- -----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discovery_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 3. PROFILES: NORMALIZATION TRIGGER (runs before CHECK constraints)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION profiles_normalize() RETURNS TRIGGER AS $$
BEGIN
  -- Round coordinates to 3 decimals (~100m precision) — privacy defense in depth.
  IF NEW.latitude IS NOT NULL THEN
    NEW.latitude := round(NEW.latitude::numeric, 3)::float;
  END IF;
  IF NEW.longitude IS NOT NULL THEN
    NEW.longitude := round(NEW.longitude::numeric, 3)::float;
  END IF;

  -- Trim + deduplicate tag arrays.
  IF NEW.skills IS NOT NULL THEN
    NEW.skills := (
      SELECT COALESCE(array_agg(DISTINCT trim(s) ORDER BY trim(s)), '{}')
      FROM unnest(NEW.skills) s
      WHERE trim(s) <> ''
    );
  END IF;
  IF NEW.interests IS NOT NULL THEN
    NEW.interests := (
      SELECT COALESCE(array_agg(DISTINCT trim(i) ORDER BY trim(i)), '{}')
      FROM unnest(NEW.interests) i
      WHERE trim(i) <> ''
    );
  END IF;

  -- Always refresh updated_at.
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_normalize ON profiles;
CREATE TRIGGER trg_profiles_normalize
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_normalize();

-- -----------------------------------------------------------------------------
-- 4. PROFILES: CLEANUP EXISTING DATA BEFORE CONSTRAINTS
-- -----------------------------------------------------------------------------
-- Force the normalize trigger to run on every existing row so lat/lng get
-- rounded and tag arrays get deduplicated before we add CHECK constraints.
UPDATE profiles SET updated_at = updated_at;

-- Clamp any over-long strings defensively (so CHECK adds don't blow up).
UPDATE profiles
SET full_name = left(full_name, 80),
    headline = left(headline, 120),
    bio = left(bio, 500)
WHERE char_length(full_name) > 80
   OR char_length(headline) > 120
   OR char_length(bio) > 500;

-- Coerce any stray looking_for values to 'networking'.
UPDATE profiles
SET looking_for = 'networking'
WHERE looking_for NOT IN ('cofounder','study-buddy','mentor','mentee','collaborator','networking','friends');

-- -----------------------------------------------------------------------------
-- 5. PROFILES: CHECK CONSTRAINTS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_full_name_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_full_name_len CHECK (char_length(full_name) <= 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_headline_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_headline_len CHECK (char_length(headline) <= 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_bio_len CHECK (char_length(bio) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_location_name_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_location_name_len CHECK (char_length(location_name) <= 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_skills_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_skills_len
      CHECK (array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_interests_len') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_interests_len
      CHECK (array_length(interests, 1) IS NULL OR array_length(interests, 1) <= 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_looking_for_enum') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_looking_for_enum
      CHECK (looking_for IN ('cofounder','study-buddy','mentor','mentee','collaborator','networking','friends'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_lat_bounds') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_lat_bounds
      CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_lng_bounds') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_lng_bounds
      CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_age_gate') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_age_gate
      CHECK (date_of_birth IS NULL OR date_of_birth <= (CURRENT_DATE - INTERVAL '13 years'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. PROFILES: INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_location
  ON profiles USING gist (ll_to_earth(latitude, longitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_discovery
  ON profiles (discovery_enabled, deleted_at)
  WHERE discovery_enabled = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_skills_gin
  ON profiles USING gin (skills);
CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin
  ON profiles USING gin (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles (last_seen DESC)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 7. CONNECTIONS: NEW COLUMNS + CANONICAL UNIQUENESS
-- -----------------------------------------------------------------------------
ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Generated columns for canonical (ordered) pair. Zero app logic, enforced by Postgres.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'connections' AND column_name = 'user_lo') THEN
    ALTER TABLE connections
      ADD COLUMN user_lo UUID GENERATED ALWAYS AS (LEAST(sender_id, receiver_id)) STORED,
      ADD COLUMN user_hi UUID GENERATED ALWAYS AS (GREATEST(sender_id, receiver_id)) STORED;
  END IF;
END $$;

-- Drop the broken one-direction unique constraint and replace with canonical.
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_sender_id_receiver_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_canonical ON connections(user_lo, user_hi);

-- Reject self-connections.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_distinct_users') THEN
    ALTER TABLE connections ADD CONSTRAINT connections_distinct_users CHECK (sender_id <> receiver_id);
  END IF;
END $$;

-- Expand status enum to support cancelled and blocked transitions.
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;
ALTER TABLE connections ADD CONSTRAINT connections_status_check
  CHECK (status IN ('pending','accepted','declined','cancelled','blocked'));

-- Length constraint on optional intro message.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_message_len') THEN
    ALTER TABLE connections ADD CONSTRAINT connections_message_len
      CHECK (message IS NULL OR char_length(trim(message)) BETWEEN 1 AND 300);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_connections_receiver_pending
  ON connections(receiver_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_connections_sender_pending
  ON connections(sender_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_connections_accepted
  ON connections(user_lo, user_hi) WHERE status = 'accepted';

-- -----------------------------------------------------------------------------
-- 8. MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_connection_created
  ON messages(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(connection_id, sender_id) WHERE read_at IS NULL AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 9. BLOCKS TABLE + HELPER
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- Mutual-hiding helper: true if either A has blocked B or B has blocked A.
CREATE OR REPLACE FUNCTION is_blocked_between(a UUID, b UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 10. REPORTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('harassment','spam','inappropriate','fake','underage','other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_id IS NULL OR reporter_id <> reported_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- -----------------------------------------------------------------------------
-- 11. RATE LIMITS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(window_start);

-- -----------------------------------------------------------------------------
-- 12. STORAGE CLEANUP QUEUE (old avatars to delete)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_cleanup (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_created ON storage_cleanup(created_at);

-- -----------------------------------------------------------------------------
-- 13. RATE LIMIT FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_action TEXT,
  p_max INT,
  p_window_sec INT
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Bucket into whole-interval windows so counts reset predictably.
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_sec) * p_window_sec);

  INSERT INTO rate_limits(user_id, action, window_start, count)
    VALUES (v_uid, p_action, v_window, 1)
    ON CONFLICT (user_id, action, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count INTO v_count;

  IF v_count > p_max THEN
    RAISE EXCEPTION 'rate_limit_exceeded: % per % seconds (action=%)', p_max, p_window_sec, p_action
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Periodic cleanup: delete old buckets. Call from a cron job.
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS VOID AS $$
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '1 day';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 14. ENABLE RLS ON ALL TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_cleanup ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 15. PROFILES RLS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles" ON profiles;
DROP POLICY IF EXISTS "Own profile update" ON profiles;
DROP POLICY IF EXISTS "Own profile insert" ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IS NOT NULL
    AND (auth.uid() = id OR NOT is_blocked_between(auth.uid(), id))
  );

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 16. CONNECTIONS RLS — SELECT via policy, writes only through RPCs
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "View own connections" ON connections;
DROP POLICY IF EXISTS "Send connection request" ON connections;
DROP POLICY IF EXISTS "Respond to received connection" ON connections;
DROP POLICY IF EXISTS "Send connection" ON connections;
DROP POLICY IF EXISTS "Update received connection" ON connections;
DROP POLICY IF EXISTS connections_select ON connections;
DROP POLICY IF EXISTS connections_insert_blocked ON connections;
DROP POLICY IF EXISTS connections_update_blocked ON connections;

CREATE POLICY connections_select ON connections FOR SELECT
  USING (auth.uid() IN (sender_id, receiver_id));

-- Block ALL direct inserts/updates from the anon role. RPCs (SECURITY DEFINER)
-- bypass RLS and are the only legitimate write path.
CREATE POLICY connections_insert_blocked ON connections FOR INSERT
  WITH CHECK (false);
CREATE POLICY connections_update_blocked ON connections FOR UPDATE
  USING (false);

-- -----------------------------------------------------------------------------
-- 17. MESSAGES RLS — SELECT scoped to accepted connections, writes via RPC
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_insert_blocked ON messages;
DROP POLICY IF EXISTS messages_update_own ON messages;

CREATE POLICY messages_select ON messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM connections c
      WHERE c.id = messages.connection_id
        AND c.status = 'accepted'
        AND auth.uid() IN (c.sender_id, c.receiver_id)
        AND NOT is_blocked_between(c.sender_id, c.receiver_id)
    )
  );

CREATE POLICY messages_insert_blocked ON messages FOR INSERT
  WITH CHECK (false);

CREATE POLICY messages_update_own ON messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 18. BLOCKS RLS — users can only see/manage their own blocks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS blocks_select_own ON blocks;
DROP POLICY IF EXISTS blocks_insert_own ON blocks;
DROP POLICY IF EXISTS blocks_delete_own ON blocks;

CREATE POLICY blocks_select_own ON blocks FOR SELECT
  USING (blocker_id = auth.uid());
CREATE POLICY blocks_insert_own ON blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY blocks_delete_own ON blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 19. REPORTS RLS — insert-only; admins use service role to review
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS reports_insert_own ON reports;
CREATE POLICY reports_insert_own ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 20. PRESENCE RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_presence() RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_bucket TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  PERFORM check_rate_limit('touch_presence', 120, 3600);

  -- Bucket to 5-minute floor to defeat stalking timing side-channels.
  v_bucket := to_timestamp(floor(extract(epoch FROM now()) / 300) * 300);

  UPDATE profiles
  SET last_seen = v_bucket,
      is_online = true
  WHERE id = v_uid AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 21. CONNECTION RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_connection_request(
  p_receiver UUID,
  p_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new_id UUID;
  v_msg TEXT;
  v_existing_id UUID;
  v_existing_status TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_receiver IS NULL THEN RAISE EXCEPTION 'receiver_required'; END IF;
  IF p_receiver = v_uid THEN RAISE EXCEPTION 'cannot_connect_to_self'; END IF;

  PERFORM check_rate_limit('send_connection', 20, 3600);

  -- Block check.
  IF is_blocked_between(v_uid, p_receiver) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- Receiver must exist and be visible.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_receiver AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'receiver_not_found';
  END IF;

  -- Normalize message.
  v_msg := nullif(trim(coalesce(p_message, '')), '');
  IF v_msg IS NOT NULL AND char_length(v_msg) > 300 THEN
    RAISE EXCEPTION 'message_too_long';
  END IF;

  -- Canonical dedup: check if any row already exists for this pair.
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM connections
  WHERE user_lo = LEAST(v_uid, p_receiver)
    AND user_hi = GREATEST(v_uid, p_receiver);

  IF v_existing_id IS NOT NULL THEN
    -- Allow re-send after a previous decline/cancel by flipping back to pending.
    IF v_existing_status IN ('declined','cancelled') THEN
      UPDATE connections
      SET sender_id = v_uid,
          receiver_id = p_receiver,
          status = 'pending',
          message = v_msg,
          cancelled_at = NULL,
          responded_at = NULL,
          created_at = now()
      WHERE id = v_existing_id;
      RETURN v_existing_id;
    ELSE
      RAISE EXCEPTION 'connection_already_exists';
    END IF;
  END IF;

  INSERT INTO connections (sender_id, receiver_id, status, message)
  VALUES (v_uid, p_receiver, 'pending', v_msg)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION respond_to_connection(
  p_connection_id UUID,
  p_accept BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row connections%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('respond_connection', 100, 3600);

  SELECT * INTO v_row FROM connections WHERE id = p_connection_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.receiver_id <> v_uid THEN RAISE EXCEPTION 'not_receiver'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'invalid_state: %', v_row.status; END IF;

  UPDATE connections
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_connection_request(
  p_connection_id UUID
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row connections%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('cancel_connection', 30, 3600);

  SELECT * INTO v_row FROM connections WHERE id = p_connection_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.sender_id <> v_uid THEN RAISE EXCEPTION 'not_sender'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'invalid_state: %', v_row.status; END IF;

  UPDATE connections
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION disconnect_connection(
  p_connection_id UUID
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row connections%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('disconnect', 10, 3600);

  SELECT * INTO v_row FROM connections WHERE id = p_connection_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_uid NOT IN (v_row.sender_id, v_row.receiver_id) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;
  IF v_row.status <> 'accepted' THEN RAISE EXCEPTION 'invalid_state: %', v_row.status; END IF;

  UPDATE connections
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 22. MESSAGING RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_message(
  p_connection_id UUID,
  p_body TEXT
) RETURNS UUID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row connections%ROWTYPE;
  v_new_id UUID;
  v_body TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('send_message', 100, 3600);

  v_body := trim(coalesce(p_body, ''));
  IF char_length(v_body) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF char_length(v_body) > 2000 THEN RAISE EXCEPTION 'body_too_long'; END IF;

  SELECT * INTO v_row FROM connections WHERE id = p_connection_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_row.status <> 'accepted' THEN RAISE EXCEPTION 'not_accepted'; END IF;
  IF v_uid NOT IN (v_row.sender_id, v_row.receiver_id) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;
  IF is_blocked_between(v_row.sender_id, v_row.receiver_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  INSERT INTO messages (connection_id, sender_id, body)
  VALUES (p_connection_id, v_uid, v_body)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_connection_id UUID
) RETURNS INT AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('mark_read', 300, 3600);

  -- Verify participation.
  IF NOT EXISTS (
    SELECT 1 FROM connections
    WHERE id = p_connection_id
      AND status = 'accepted'
      AND v_uid IN (sender_id, receiver_id)
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  UPDATE messages
  SET read_at = now()
  WHERE connection_id = p_connection_id
    AND sender_id <> v_uid
    AND read_at IS NULL
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_messages_page(
  p_connection_id UUID,
  p_before TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 50
) RETURNS TABLE (
  id UUID,
  connection_id UUID,
  sender_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_limit > 100 THEN p_limit := 100; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM connections
    WHERE id = p_connection_id
      AND status = 'accepted'
      AND v_uid IN (sender_id, receiver_id)
      AND NOT is_blocked_between(sender_id, receiver_id)
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  RETURN QUERY
  SELECT m.id, m.connection_id, m.sender_id, m.body, m.created_at, m.read_at, m.edited_at
  FROM messages m
  WHERE m.connection_id = p_connection_id
    AND m.deleted_at IS NULL
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 23. MODERATION RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION block_user(
  p_blocked_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = v_uid THEN RAISE EXCEPTION 'invalid_target'; END IF;
  PERFORM check_rate_limit('block', 50, 3600);

  INSERT INTO blocks (blocker_id, blocked_id, reason)
  VALUES (v_uid, p_blocked_id, nullif(trim(coalesce(p_reason, '')), ''))
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Mark any existing connection as blocked so it disappears from both sides.
  UPDATE connections
  SET status = 'blocked'
  WHERE user_lo = LEAST(v_uid, p_blocked_id)
    AND user_hi = GREATEST(v_uid, p_blocked_id)
    AND status IN ('pending','accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION unblock_user(
  p_blocked_id UUID
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('unblock', 50, 3600);

  DELETE FROM blocks WHERE blocker_id = v_uid AND blocked_id = p_blocked_id;
  -- Note: we do NOT automatically re-open a blocked connection. User must re-send.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION report_user(
  p_reported_id UUID,
  p_category TEXT,
  p_details TEXT DEFAULT NULL,
  p_message_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_reported_id IS NULL OR p_reported_id = v_uid THEN RAISE EXCEPTION 'invalid_target'; END IF;
  PERFORM check_rate_limit('report', 10, 86400);

  INSERT INTO reports (reporter_id, reported_id, category, details, message_id)
  VALUES (v_uid, p_reported_id, p_category, nullif(trim(coalesce(p_details, '')), ''), p_message_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 24. PROFILE SAFE UPDATE + AVATAR SWAP
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_profile_safe(
  p_payload JSONB
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('profile_update', 30, 3600);

  -- Whitelist keys. Any key not here is silently ignored.
  UPDATE profiles SET
    full_name             = COALESCE(p_payload->>'full_name', full_name),
    headline              = COALESCE(p_payload->>'headline', headline),
    bio                   = COALESCE(p_payload->>'bio', bio),
    avatar_url            = COALESCE(p_payload->>'avatar_url', avatar_url),
    skills                = COALESCE(
                              CASE WHEN p_payload ? 'skills'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'skills'))
                                   ELSE NULL
                              END,
                              skills
                            ),
    interests             = COALESCE(
                              CASE WHEN p_payload ? 'interests'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'interests'))
                                   ELSE NULL
                              END,
                              interests
                            ),
    looking_for           = COALESCE(p_payload->>'looking_for', looking_for),
    latitude              = COALESCE((p_payload->>'latitude')::float, latitude),
    longitude             = COALESCE((p_payload->>'longitude')::float, longitude),
    location_name         = COALESCE(p_payload->>'location_name', location_name),
    discovery_enabled     = COALESCE((p_payload->>'discovery_enabled')::boolean, discovery_enabled),
    date_of_birth         = COALESCE((p_payload->>'date_of_birth')::date, date_of_birth),
    terms_accepted_at     = COALESCE((p_payload->>'terms_accepted_at')::timestamptz, terms_accepted_at),
    onboarding_completed_at = COALESCE((p_payload->>'onboarding_completed_at')::timestamptz, onboarding_completed_at)
  WHERE id = v_uid AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_avatar_url(
  p_new_path TEXT
) RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('avatar_upload', 10, 3600);

  SELECT avatar_url INTO v_old FROM profiles WHERE id = v_uid;

  UPDATE profiles SET avatar_url = p_new_path WHERE id = v_uid AND deleted_at IS NULL;

  -- Queue old for deletion if it was a Supabase Storage path (starts with the user's folder).
  IF v_old IS NOT NULL AND v_old LIKE '%/' || v_uid::text || '/%' AND v_old <> p_new_path THEN
    INSERT INTO storage_cleanup (bucket, path)
    VALUES ('avatars', v_old);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 25. ACCOUNT DELETION (SOFT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION soft_delete_account() RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('delete_account', 3, 86400);

  -- Tombstone the profile and null out PII. Keep id + timestamps so FKs stay valid.
  UPDATE profiles
  SET deleted_at        = now(),
      full_name         = '[deleted user]',
      headline          = '',
      bio               = '',
      avatar_url        = NULL,
      skills            = '{}',
      interests         = '{}',
      latitude          = NULL,
      longitude         = NULL,
      location_name     = '',
      date_of_birth     = NULL,
      discovery_enabled = false,
      is_online         = false
  WHERE id = v_uid;

  -- Cancel all in-flight connections involving this user.
  UPDATE connections
  SET status = 'cancelled', cancelled_at = now()
  WHERE (sender_id = v_uid OR receiver_id = v_uid)
    AND status IN ('pending','accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 26. GET_NEARBY_PROFILES — REWRITTEN (no lat/lng leakage, pagination, blocks)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_nearby_profiles(FLOAT, FLOAT, FLOAT, UUID);
DROP FUNCTION IF EXISTS get_nearby_profiles(FLOAT, FLOAT, FLOAT, INT, INT, TEXT);

CREATE OR REPLACE FUNCTION get_nearby_profiles(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 10,
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0,
  p_looking_for TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  headline TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[],
  interests TEXT[],
  looking_for TEXT,
  location_name TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMPTZ,
  distance_km FLOAT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('nearby_fetch', 120, 3600);

  IF p_limit IS NULL OR p_limit > 100 THEN p_limit := 100; END IF;
  IF p_limit < 1 THEN p_limit := 30; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;
  IF radius_km IS NULL OR radius_km > 100 THEN radius_km := 100; END IF;
  IF radius_km < 0.1 THEN radius_km := 0.1; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.headline,
    p.bio,
    p.avatar_url,
    p.skills,
    p.interests,
    p.looking_for,
    p.location_name,
    (p.last_seen > now() - INTERVAL '5 minutes') AS is_online,
    p.last_seen,
    ROUND(
      (earth_distance(
        ll_to_earth(user_lat, user_lng),
        ll_to_earth(p.latitude, p.longitude)
      ) / 1000)::numeric, 2
    )::FLOAT AS distance_km
  FROM profiles p
  WHERE p.id <> v_uid
    AND p.deleted_at IS NULL
    AND p.discovery_enabled = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND NOT is_blocked_between(v_uid, p.id)
    AND (p_looking_for IS NULL OR p.looking_for = p_looking_for)
    AND earth_box(ll_to_earth(user_lat, user_lng), radius_km * 1000) @> ll_to_earth(p.latitude, p.longitude)
    AND earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(p.latitude, p.longitude)
    ) <= radius_km * 1000
  ORDER BY earth_distance(
    ll_to_earth(user_lat, user_lng),
    ll_to_earth(p.latitude, p.longitude)
  ) ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 27. PROFILE WITH DISTANCE (for ProfilePage)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_profile_with_distance(
  p_id UUID,
  user_lat FLOAT DEFAULT NULL,
  user_lng FLOAT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  headline TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[],
  interests TEXT[],
  looking_for TEXT,
  location_name TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMPTZ,
  distance_km FLOAT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'id_required'; END IF;

  IF p_id <> v_uid AND is_blocked_between(v_uid, p_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.headline,
    p.bio,
    p.avatar_url,
    p.skills,
    p.interests,
    p.looking_for,
    p.location_name,
    (p.last_seen > now() - INTERVAL '5 minutes') AS is_online,
    p.last_seen,
    CASE
      WHEN user_lat IS NULL OR user_lng IS NULL OR p.latitude IS NULL OR p.longitude IS NULL
        THEN NULL::FLOAT
      ELSE ROUND(
        (earth_distance(
          ll_to_earth(user_lat, user_lng),
          ll_to_earth(p.latitude, p.longitude)
        ) / 1000)::numeric, 2
      )::FLOAT
    END AS distance_km
  FROM profiles p
  WHERE p.id = p_id AND p.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 28. SEARCH PROFILES (Phase 3.12 — stretch)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_profiles(
  p_query TEXT,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  headline TEXT,
  avatar_url TEXT,
  skills TEXT[],
  interests TEXT[],
  looking_for TEXT,
  location_name TEXT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_q TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM check_rate_limit('search', 60, 3600);

  v_q := trim(coalesce(p_query, ''));
  IF char_length(v_q) < 2 THEN RETURN; END IF;
  IF p_limit > 50 THEN p_limit := 50; END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.headline, p.avatar_url, p.skills, p.interests, p.looking_for, p.location_name
  FROM profiles p
  WHERE p.id <> v_uid
    AND p.deleted_at IS NULL
    AND p.discovery_enabled = true
    AND NOT is_blocked_between(v_uid, p.id)
    AND (
      p.full_name ILIKE '%' || v_q || '%'
      OR EXISTS (SELECT 1 FROM unnest(p.skills) s WHERE s ILIKE '%' || v_q || '%')
      OR EXISTS (SELECT 1 FROM unnest(p.interests) i WHERE i ILIKE '%' || v_q || '%')
    )
  ORDER BY similarity(p.full_name, v_q) DESC NULLS LAST, p.full_name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 29. GRANTS — expose RPCs to authenticated role
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION touch_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION send_connection_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_connection(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_connection_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION disconnect_connection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages_page(UUID, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION block_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION report_user(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_profile_safe(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION set_avatar_url(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_account() TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_profiles(FLOAT, FLOAT, FLOAT, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_with_distance(UUID, FLOAT, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_profiles(TEXT, INT) TO authenticated;

COMMIT;

-- =============================================================================
-- Post-migration sanity checks (run manually):
--
--   SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass;
--   SELECT indexname FROM pg_indexes WHERE tablename IN ('profiles','connections','messages','blocks','reports');
--   SELECT proname FROM pg_proc WHERE proname LIKE '%connection%' OR proname LIKE '%message%';
--   EXPLAIN ANALYZE SELECT * FROM get_nearby_profiles(37.33, -121.88, 10);
-- =============================================================================
