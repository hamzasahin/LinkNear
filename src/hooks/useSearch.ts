import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { SearchResult } from '../types'

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchProfiles = useCallback((query: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)

    debounceTimer.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error: rpcError } = await supabase.rpc('search_profiles', {
          search_query: trimmed,
          current_user_id: user?.id ?? null,
        })
        if (rpcError) {
          setError(rpcError.message)
          setResults([])
        } else {
          setResults((data as SearchResult[]) ?? [])
          setError(null)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const clearResults = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    setResults([])
    setLoading(false)
    setError(null)
  }, [])

  return { results, loading, error, searchProfiles, clearResults }
}
