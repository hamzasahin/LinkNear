-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  headline TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  looking_for TEXT DEFAULT 'networking',
  latitude FLOAT,
  longitude FLOAT,
  location_name TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Connections table
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- RPC function for nearby user discovery
CREATE OR REPLACE FUNCTION get_nearby_profiles(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 10,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  headline TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[],
  interests TEXT[],
  looking_for TEXT,
  latitude FLOAT,
  longitude FLOAT,
  location_name TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMPTZ,
  distance_km FLOAT
) AS $$
BEGIN
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
    p.latitude,
    p.longitude,
    p.location_name,
    p.is_online,
    p.last_seen,
    ROUND(
      (earth_distance(
        ll_to_earth(user_lat, user_lng),
        ll_to_earth(p.latitude, p.longitude)
      ) / 1000)::numeric, 2
    )::FLOAT AS distance_km
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND earth_distance(
      ll_to_earth(user_lat, user_lng),
      ll_to_earth(p.latitude, p.longitude)
    ) <= radius_km * 1000
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "View own connections" ON connections
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Send connection request" ON connections
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Respond to received connection" ON connections
  FOR UPDATE USING (auth.uid() = receiver_id);
