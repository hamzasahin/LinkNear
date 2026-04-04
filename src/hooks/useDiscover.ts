import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { NearbyProfile, Profile } from '../types'
import { calculateMatchScore } from '../utils/matchScore'
import { rpcWithRetry } from '../lib/rpcRetry'

const PAGE_SIZE = 30

interface FetchParams {
  lat: number
  lng: number
  radiusKm?: number
  lookingFor?: string | null
  myProfile?: Profile | null
}

interface UseDiscoverReturn {
  profiles: NearbyProfile[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  fetchNearbyProfiles: (params: FetchParams) => Promise<void>
  loadMore: () => Promise<void>
  reset: () => void
}

export function useDiscover(): UseDiscoverReturn {
  const [profiles, setProfiles] = useState<NearbyProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  // Keep the last fetch params so loadMore can re-use them.
  const lastParams = useRef<FetchParams | null>(null)
  const offsetRef = useRef(0)

  const enrich = useCallback(
    (rows: NearbyProfile[], myProfile: Profile | null | undefined): NearbyProfile[] =>
      rows.map(p => ({
        ...p,
        match_score: myProfile ? calculateMatchScore(myProfile, p) : undefined,
      })),
    []
  )

  const fetchNearbyProfiles = useCallback(
    async (params: FetchParams) => {
      setLoading(true)
      setError(null)
      offsetRef.current = 0
      lastParams.current = params

      try {
        const data = await rpcWithRetry<NearbyProfile[]>(() =>
          supabase.rpc('get_nearby_profiles', {
            user_lat: params.lat,
            user_lng: params.lng,
            radius_km: params.radiusKm ?? 10,
            p_limit: PAGE_SIZE,
            p_offset: 0,
            p_looking_for: params.lookingFor ?? null,
          })
        )
        const enriched = enrich(data ?? [], params.myProfile)
        setProfiles(enriched)
        setHasMore((data ?? []).length === PAGE_SIZE)
        offsetRef.current = enriched.length
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setProfiles([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    },
    [enrich]
  )

  const loadMore = useCallback(async () => {
    const params = lastParams.current
    if (!params || loadingMore || loading || !hasMore) return
    setLoadingMore(true)
    setError(null)

    try {
      const data = await rpcWithRetry<NearbyProfile[]>(() =>
        supabase.rpc('get_nearby_profiles', {
          user_lat: params.lat,
          user_lng: params.lng,
          radius_km: params.radiusKm ?? 10,
          p_limit: PAGE_SIZE,
          p_offset: offsetRef.current,
          p_looking_for: params.lookingFor ?? null,
        })
      )
      const enriched = enrich(data ?? [], params.myProfile)
      setProfiles(prev => {
        const seen = new Set(prev.map(p => p.id))
        const fresh = enriched.filter(p => !seen.has(p.id))
        return [...prev, ...fresh]
      })
      setHasMore((data ?? []).length === PAGE_SIZE)
      offsetRef.current += enriched.length
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }, [enrich, hasMore, loading, loadingMore])

  const reset = useCallback(() => {
    setProfiles([])
    setHasMore(false)
    offsetRef.current = 0
    lastParams.current = null
    setError(null)
  }, [])

  return { profiles, loading, loadingMore, error, hasMore, fetchNearbyProfiles, loadMore, reset }
}
