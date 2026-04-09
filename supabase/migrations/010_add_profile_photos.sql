-- Profile photos gallery (up to 6 photos per user)
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_user ON profile_photos(user_id, sort_order);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can see photos (privacy is enforced client-side via connection status)
CREATE POLICY profile_photos_select ON profile_photos FOR SELECT USING (true);
-- Only owner can insert/delete their own photos
CREATE POLICY profile_photos_insert ON profile_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profile_photos_delete ON profile_photos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY profile_photos_update ON profile_photos FOR UPDATE USING (auth.uid() = user_id);
