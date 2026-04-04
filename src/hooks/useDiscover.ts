import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { NearbyProfile, Profile } from '../types'
import { calculateMatchScore } from '../utils/matchScore'

interface UseDiscoverReturn {
  profiles: NearbyProfile[]
  loading: boolean
  error: string | null
  fetchNearbyProfiles: (lat: number, lng: number, radiusKm?: number, myProfile?: Profile | null) => Promise<void>
}

export function useDiscover(): UseDiscoverReturn {
  const [profiles, setProfiles] = useState<NearbyProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNearbyProfiles = useCallback(async (
    lat: number,
    lng: number,
    radiusKm: number = 10,
    myProfile: Profile | null = null
  ) => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error: rpcError } = await supabase.rpc('get_nearby_profiles', {
      user_lat: lat,
      user_lng: lng,
      radius_km: radiusKm,
      current_user_id: user?.id || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    const enriched: NearbyProfile[] = (data || []).map((p: NearbyProfile) => ({
      ...p,
      match_score: myProfile ? calculateMatchScore(myProfile, p) : undefined,
    }))

    setProfiles(enriched)
    setLoading(false)
  }, [])

  return { profiles, loading, error, fetchNearbyProfiles }
}
