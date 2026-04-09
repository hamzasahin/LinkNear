-- =============================================================================
-- LinkNear — Target Schema (canonical state)
-- =============================================================================
-- This file reflects the state after all migrations have been applied.
-- For existing databases, run migrations in order instead of this file.
-- For a fresh database, running this file alone is equivalent.
--
-- The migration history lives in supabase/migrations/.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 80),
  headline TEXT DEFAULT '' CHECK (char_length(headline) <= 120),
  bio TEXT DEFAULT '' CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}' CHECK (array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 20),
  interests TEXT[] DEFAULT '{}' CHECK (array_length(interests, 1) IS NULL OR array_length(interests, 1) <= 20),
  looking_for TEXT DEFAULT 'networking'
    CHECK (looking_for IN ('cofounder','study-buddy','mentor','mentee','collaborator','networking','friends')),
  latitude FLOAT CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude FLOAT CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  location_name TEXT DEFAULT '' CHECK (char_length(location_name) <= 120),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Production safety columns
  deleted_at TIMESTAMPTZ,
  discovery_enabled BOOLEAN NOT NULL DEFAULT true,
  date_of_birth DATE CHECK (date_of_birth IS NULL OR date_of_birth <= (CURRENT_DATE - INTERVAL '13 years')),
  terms_accepted_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  -- Photo privacy
  show_photo_publicly BOOLEAN DEFAULT false,
  -- Challenge / streak system
  streak_count INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_points INT DEFAULT 0,
  challenges_completed INT DEFAULT 0,
  last_challenge_date DATE,
  -- Quiz
  quiz_completed BOOLEAN DEFAULT false,
  -- Premium
  is_premium BOOLEAN DEFAULT false,
  premium_until TIMESTAMPTZ,
  -- Email preferences
  email_digest BOOLEAN DEFAULT true
);

-- Normalize on write: round lat/lng to ~100m, dedupe/trim tag arrays, touch updated_at
CREATE OR REPLACE FUNCTION profiles_normalize() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL THEN
    NEW.latitude := round(NEW.latitude::numeric, 3)::float;
  END IF;
  IF NEW.longitude IS NOT NULL THEN
    NEW.longitude := round(NEW.longitude::numeric, 3)::float;
  END IF;
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
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_normalize ON profiles;
CREATE TRIGGER trg_profiles_normalize
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_normalize();

CREATE INDEX IF NOT EXISTS idx_profiles_location
  ON profiles USING gist (ll_to_earth(latitude, longitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_discovery
  ON profiles (discovery_enabled, deleted_at)
  WHERE discovery_enabled = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_skills_gin    ON profiles USING gin (skills);
CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin ON profiles USING gin (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm     ON profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles (last_seen DESC) WHERE deleted_at IS NULL;

-- =============================================================================
-- CONNECTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','cancelled','blocked')),
  message TEXT CHECK (message IS NULL OR char_length(trim(message)) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  user_lo UUID GENERATED ALWAYS AS (LEAST(sender_id, receiver_id)) STORED,
  user_hi UUID GENERATED ALWAYS AS (GREATEST(sender_id, receiver_id)) STORED,
  CONSTRAINT connections_distinct_users CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_canonical ON connections(user_lo, user_hi);
CREATE INDEX IF NOT EXISTS idx_connections_receiver_pending
  ON connections(receiver_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_connections_sender_pending
  ON connections(sender_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_connections_accepted
  ON connections(user_lo, user_hi) WHERE status = 'accepted';

-- =============================================================================
-- MESSAGES
-- =============================================================================
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

-- =============================================================================
-- BLOCKS
-- =============================================================================
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

CREATE OR REPLACE FUNCTION is_blocked_between(a UUID, b UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- REPORTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN ('harassment','spam','inappropriate','fake','underage','other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_id IS NULL OR reporter_id <> reported_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status, created_at DESC);

-- =============================================================================
-- RATE LIMITS + STORAGE CLEANUP
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(window_start);

CREATE TABLE IF NOT EXISTS storage_cleanup (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_created ON storage_cleanup(created_at);

-- =============================================================================
-- CHARACTER QUIZ
-- =============================================================================
CREATE TABLE IF NOT EXISTS character_quiz (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  core_values TEXT[] DEFAULT '{}',
  communication_style TEXT DEFAULT 'balanced',
  work_style TEXT DEFAULT 'flexible',
  raw_answers JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- CHALLENGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('kindness', 'knowledge', 'community', 'self', 'generosity', 'gratitude')),
  source TEXT,
  source_text TEXT,
  difficulty TEXT DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  reflection TEXT,
  shared_to_feed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, assigned_date)
);

-- =============================================================================
-- FEED
-- =============================================================================
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  post_type TEXT DEFAULT 'reflection' CHECK (post_type IN ('reflection', 'challenge_complete', 'milestone', 'gratitude', 'learning')),
  challenge_id UUID REFERENCES challenges(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IS NOT NULL
    AND (auth.uid() = id OR NOT is_blocked_between(auth.uid(), id))
  );
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS connections_select ON connections;
CREATE POLICY connections_select ON connections FOR SELECT
  USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS connections_insert_blocked ON connections;
CREATE POLICY connections_insert_blocked ON connections FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS connections_update_blocked ON connections;
CREATE POLICY connections_update_blocked ON connections FOR UPDATE USING (false);

DROP POLICY IF EXISTS messages_select ON messages;
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
DROP POLICY IF EXISTS messages_insert_blocked ON messages;
CREATE POLICY messages_insert_blocked ON messages FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS messages_update_own ON messages;
CREATE POLICY messages_update_own ON messages FOR UPDATE
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS blocks_select_own ON blocks;
CREATE POLICY blocks_select_own ON blocks FOR SELECT USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_insert_own ON blocks;
CREATE POLICY blocks_insert_own ON blocks FOR INSERT WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_delete_own ON blocks;
CREATE POLICY blocks_delete_own ON blocks FOR DELETE USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS reports_insert_own ON reports;
CREATE POLICY reports_insert_own ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Own quiz" ON character_quiz;
CREATE POLICY "Own quiz" ON character_quiz FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Read quiz basics" ON character_quiz;
CREATE POLICY "Read quiz basics" ON character_quiz FOR SELECT USING (true);

DROP POLICY IF EXISTS challenges_select ON challenges;
CREATE POLICY challenges_select ON challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS user_challenges_all ON user_challenges;
CREATE POLICY user_challenges_all ON user_challenges FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS feed_posts_select ON feed_posts;
CREATE POLICY feed_posts_select ON feed_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS feed_posts_insert ON feed_posts;
CREATE POLICY feed_posts_insert ON feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS feed_posts_delete ON feed_posts;
CREATE POLICY feed_posts_delete ON feed_posts FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS feed_likes_select ON feed_likes;
CREATE POLICY feed_likes_select ON feed_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS feed_likes_insert ON feed_likes;
CREATE POLICY feed_likes_insert ON feed_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS feed_likes_delete ON feed_likes;
CREATE POLICY feed_likes_delete ON feed_likes FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FEED RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION get_local_feed(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 8,
  page_limit INT DEFAULT 20,
  page_offset INT DEFAULT 0
)
RETURNS TABLE (
  post_id UUID,
  user_id UUID,
  full_name TEXT,
  headline TEXT,
  avatar_url TEXT,
  show_photo_publicly BOOLEAN,
  content TEXT,
  post_type TEXT,
  challenge_title TEXT,
  challenge_source TEXT,
  challenge_source_text TEXT,
  likes_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id AS post_id,
    fp.user_id,
    p.full_name,
    p.headline,
    p.avatar_url,
    p.show_photo_publicly,
    fp.content,
    fp.post_type,
    c.title AS challenge_title,
    c.source AS challenge_source,
    c.source_text AS challenge_source_text,
    (SELECT COUNT(*) FROM feed_likes fl WHERE fl.post_id = fp.id) AS likes_count,
    fp.created_at
  FROM feed_posts fp
  JOIN profiles p ON fp.user_id = p.id
  LEFT JOIN challenges c ON fp.challenge_id = c.id
  WHERE p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(p.latitude, p.longitude)
    ) <= radius_km * 1000
  ORDER BY fp.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEARCH RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION search_profiles(
  search_query TEXT,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  headline TEXT,
  skills TEXT[],
  interests TEXT[],
  looking_for TEXT,
  location_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.full_name, p.headline,
    p.skills, p.interests, p.looking_for, p.location_name
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.deleted_at IS NULL
    AND (
      p.full_name ILIKE '%' || search_query || '%'
      OR p.headline ILIKE '%' || search_query || '%'
      OR EXISTS (SELECT 1 FROM unnest(p.skills) s WHERE s ILIKE '%' || search_query || '%')
      OR EXISTS (SELECT 1 FROM unnest(p.interests) i WHERE i ILIKE '%' || search_query || '%')
    )
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPCs and mutation functions (send_connection_request, send_message,
-- get_nearby_profiles, block_user, etc.) live in:
--   supabase/migrations/001_production_foundation.sql
--
-- For a fresh database, run the migration file — it includes both the table
-- definitions above AND all RPCs. This file is kept minimal to serve as a
-- readable reference for the table layout and policies.
-- =============================================================================
