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
  // Photo privacy
  show_photo_publicly?: boolean
  // Challenge / streak system
  streak_count?: number
  longest_streak?: number
  total_points?: number
  challenges_completed?: number
  last_challenge_date?: string | null
  // Quiz
  quiz_completed?: boolean
  // Premium
  is_premium?: boolean
  premium_until?: string | null
  // Email preferences
  email_digest?: boolean
}

export interface SearchResult {
  id: string
  full_name: string
  headline: string
  skills: string[]
  interests: string[]
  looking_for: string
  location_name: string
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
  show_photo_publicly?: boolean
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

export interface CharacterQuiz {
  id: string
  user_id: string
  core_values: string[]
  communication_style: 'direct' | 'diplomatic' | 'analytical' | 'connector' | 'balanced'
  work_style: 'researcher' | 'executor' | 'collaborator' | 'independent' | 'flexible'
  raw_answers: Record<string, string>
  completed_at: string | null
  created_at: string
}

export type ReportCategory =
  | 'harassment'
  | 'spam'
  | 'inappropriate'
  | 'fake'
  | 'underage'
  | 'other'

export interface Challenge {
  id: string
  title: string
  description: string
  category: 'kindness' | 'knowledge' | 'community' | 'self' | 'generosity' | 'gratitude'
  source: string | null
  source_text: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  is_active: boolean
  created_at: string
}

export interface UserChallenge {
  id: string
  user_id: string
  challenge_id: string
  assigned_date: string
  completed: boolean
  completed_at: string | null
  reflection: string | null
  shared_to_feed: boolean
  created_at: string
  challenge?: Challenge
}

export interface FeedPost {
  post_id: string
  user_id: string
  full_name: string
  headline: string
  avatar_url: string | null
  show_photo_publicly: boolean
  content: string
  post_type: 'reflection' | 'challenge_complete' | 'milestone' | 'gratitude' | 'learning'
  challenge_title: string | null
  challenge_source: string | null
  challenge_source_text: string | null
  likes_count: number
  created_at: string
  liked_by_me?: boolean
}
