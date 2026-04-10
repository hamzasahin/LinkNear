-- Migration: add search_profiles RPC + premium columns
-- =============================================================================

-- 1. Premium columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- 2. search_profiles RPC — full-text ILIKE search across name, headline, skills, interests
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
