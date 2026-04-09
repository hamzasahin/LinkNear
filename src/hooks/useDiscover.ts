import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { NearbyProfile, Profile, CharacterQuiz } from '../types'
import { calculateMatchScore } from '../utils/matchScore'
import { rpcWithRetry } from '../lib/rpcRetry'

const PAGE_SIZE = 30
export const FREE_RADIUS_KM = 8   // ~5 miles
export const PREMIUM_MAX_RADIUS_KM = 80  // ~50 miles

interface FetchParams {
  lat: number
  lng: number
  radiusKm?: number
  lookingFor?: string | null
  myProfile?: Profile | null
  myQuiz?: CharacterQuiz | null
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
    (
      rows: NearbyProfile[],
      myProfile: Profile | null | undefined,
      myQuiz: CharacterQuiz | null | undefined,
      quizMap: Map<string, CharacterQuiz>
    ): NearbyProfile[] =>
      rows.map(p => ({
        ...p,
        match_score: myProfile
          ? calculateMatchScore(myProfile, p, {
              mine: myQuiz ?? null,
              theirs: quizMap.get(p.id) ?? null,
            })
          : undefined,
      })),
    []
  )

  /** Fetch quiz rows for the given user IDs. */
  const fetchQuizzes = useCallback(async (userIds: string[]): Promise<Map<string, CharacterQuiz>> => {
    const map = new Map<string, CharacterQuiz>()
    if (userIds.length === 0) return map
    const { data } = await supabase
      .from('character_quiz')
      .select('*')
      .in('user_id', userIds)
    if (data) {
      for (const q of data) {
        map.set(q.user_id, q as CharacterQuiz)
      }
    }
    return map
  }, [])

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
        const rows = data ?? []
        const quizMap = await fetchQuizzes(rows.map(p => p.id))
        const enriched = enrich(rows, params.myProfile, params.myQuiz, quizMap)
        setProfiles(enriched)
        setHasMore(rows.length === PAGE_SIZE)
        offsetRef.current = enriched.length
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setProfiles([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    },
    [enrich, fetchQuizzes]
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
      const rows = data ?? []
      const quizMap = await fetchQuizzes(rows.map(p => p.id))
      const enriched = enrich(rows, params.myProfile, params.myQuiz, quizMap)
      setProfiles(prev => {
        const seen = new Set(prev.map(p => p.id))
        const fresh = enriched.filter(p => !seen.has(p.id))
        return [...prev, ...fresh]
      })
      setHasMore(rows.length === PAGE_SIZE)
      offsetRef.current += enriched.length
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }, [enrich, fetchQuizzes, hasMore, loading, loadingMore])

  const reset = useCallback(() => {
    setProfiles([])
    setHasMore(false)
    offsetRef.current = 0
    lastParams.current = null
    setError(null)
  }, [])

  return { profiles, loading, loadingMore, error, hasMore, fetchNearbyProfiles, loadMore, reset }
}
