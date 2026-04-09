-- Migration 008: Add feed tables and RPC
-- =============================================================================

-- Tables
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

-- Row Level Security
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- RPC
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
