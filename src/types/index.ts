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
}

export interface NearbyProfile extends Profile {
  distance_km: number
  match_score?: number
}

export interface Connection {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string | null
  created_at: string
  sender?: Profile
  receiver?: Profile
}
