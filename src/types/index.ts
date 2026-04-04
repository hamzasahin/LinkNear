export interface Profile {
  id: string
  full_name: string
  headline: string
  bio: string
  avatar_url: string | null
  skills: string[]
  interests: string[]
  looking_for: string
  latitude: number | null
  longitude: number | null
  location_name: string
  is_online: boolean
  last_seen: string
  created_at: string
  updated_at: string
  // Production safety fields
  deleted_at?: string | null
  discovery_enabled?: boolean
  date_of_birth?: string | null
  terms_accepted_at?: string | null
  onboarding_completed_at?: string | null
}

// Rows returned by the `get_nearby_profiles` RPC. Latitude / longitude are
// intentionally stripped server-side — callers get `distance_km` and must
// never compute distance client-side from raw coordinates.
export interface NearbyProfile {
  id: string
  full_name: string
  headline: string
  bio: string
  avatar_url: string | null
  skills: string[]
  interests: string[]
  looking_for: string
  location_name: string
  is_online: boolean
  last_seen: string
  distance_km: number
  match_score?: number
}

// Rows returned by the `get_profile_with_distance` RPC — same shape as
// NearbyProfile but `distance_km` can be null (when viewer location is unknown).
export interface ProfileWithDistance extends Omit<NearbyProfile, 'distance_km'> {
  distance_km: number | null
}

export interface Connection {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'blocked'
  message: string | null
  created_at: string
  responded_at?: string | null
  cancelled_at?: string | null
  sender?: Profile
  receiver?: Profile
}

export interface Message {
  id: string
  connection_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  edited_at: string | null
}

export interface Block {
  id: string
  blocker_id: string
  blocked_id: string
  reason: string | null
  created_at: string
  blocked?: Profile
}

export type ReportCategory =
  | 'harassment'
  | 'spam'
  | 'inappropriate'
  | 'fake'
  | 'underage'
  | 'other'
