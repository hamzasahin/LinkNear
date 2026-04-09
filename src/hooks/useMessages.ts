import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useRealtime } from '../contexts/RealtimeContext'
import { track } from '../lib/analytics'
import { rpcWithRetry } from '../lib/rpcRetry'

const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 3000 // Poll every 3s as a Realtime fallback

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  sendMessage: (body: string) => Promise<{ error: string | null }>
  loadMore: () => Promise<void>
  markRead: () => Promise<void>
}

/**
 * Fetches + live-subscribes to messages for one connection.
 *
 * Uses a dual strategy: Realtime events + polling fallback.
 * Realtime may not fire reliably due to complex RLS on messages,
 * so we poll every few seconds as a safety net.
 */
export function useMessages(connectionId: string | undefined): UseMessagesReturn {
  const { user } = useAuth()
  const { getMessagesVersion, refresh: refreshRealtime } = useRealtime()
  const liveVersion = connectionId ? getMessagesVersion(connectionId) : 0

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const oldestCursorRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const fetchNewest = useCallback(async (): Promise<Message[]> => {
    if (!connectionId) return []
    const rows = await rpcWithRetry<Message[]>(() =>
      supabase.rpc('get_messages_page', {
        p_connection_id: connectionId,
        p_before: null,
        p_limit: PAGE_SIZE,
      })
    )
    return (rows ?? []).slice().reverse()
  }, [connectionId])

  const loadInitial = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)
    try {
      const ordered = await fetchNewest()
      if (!mountedRef.current) return
      setMessages(ordered)
      setHasMore(ordered.length === PAGE_SIZE)
      oldestCursorRef.current = ordered[0]?.created_at ?? null
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [connectionId, fetchNewest])

  // Merge new rows into current state without duplicates.
  const mergeNewest = useCallback(async () => {
    if (!connectionId) return
    try {
      const ordered = await fetchNewest()
      if (!mountedRef.current) return
      setMessages(prev => {
        // Start from non-optimistic messages only
        const byId = new Map(prev.filter(m => !m.id.startsWith('optimistic-')).map(m => [m.id, m]))
        let changed = prev.some(m => m.id.startsWith('optimistic-'))
        for (const m of ordered) {
          if (!byId.has(m.id) || byId.get(m.id)!.read_at !== m.read_at) {
            byId.set(m.id, m)
            changed = true
          }
        }
        if (!changed) return prev
        return Array.from(byId.values()).sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        )
      })
    } catch {
      // Swallow — next poll will retry.
    }
  }, [connectionId, fetchNewest])

  const loadMore = useCallback(async () => {
    if (!connectionId || !hasMore || loadingMore || loading) return
    const cursor = oldestCursorRef.current
    if (!cursor) return
    setLoadingMore(true)
    try {
      const rows = await rpcWithRetry<Message[]>(() =>
        supabase.rpc('get_messages_page', {
          p_connection_id: connectionId,
          p_before: cursor,
          p_limit: PAGE_SIZE,
        })
      )
      const ordered = (rows ?? []).slice().reverse()
      if (ordered.length > 0) {
        setMessages(prev => [...ordered, ...prev])
        oldestCursorRef.current = ordered[0].created_at
      }
      setHasMore((rows ?? []).length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }, [connectionId, hasMore, loadingMore, loading])

  const sendMessage = async (body: string): Promise<{ error: string | null }> => {
    if (!connectionId || !user) return { error: 'Not ready' }
    const trimmed = body.trim()
    if (!trimmed) return { error: 'Message is empty' }
    if (trimmed.length > 2000) return { error: 'Message is too long (max 2000 chars)' }

    // Optimistic update — add the message immediately so the user sees it
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      connection_id: connectionId,
      sender_id: user.id,
      body: trimmed,
      created_at: new Date().toISOString(),
      read_at: null,
      edited_at: null,
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      await rpcWithRetry<string>(() =>
        supabase.rpc('send_message', {
          p_connection_id: connectionId,
          p_body: trimmed,
        })
      )
      // Remove the optimistic placeholder, then fetch the real message from server
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      void mergeNewest()
      track('message_sent')
      return { error: null }
    } catch (e) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const markRead = useCallback(async () => {
    if (!connectionId) return
    try {
      await rpcWithRetry<number>(() =>
        supabase.rpc('mark_messages_read', { p_connection_id: connectionId })
      )
      // Tell RealtimeContext to refresh the badge count immediately
      refreshRealtime()
    } catch {
      // Non-critical.
    }
  }, [connectionId, refreshRealtime])

  // Initial load
  useEffect(() => {
    mountedRef.current = true
    loadInitial()
    return () => { mountedRef.current = false }
  }, [loadInitial])

  // Re-merge on Realtime events
  useEffect(() => {
    if (liveVersion > 0) {
      void mergeNewest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveVersion])

  // Polling fallback — catches messages that Realtime missed
  useEffect(() => {
    if (!connectionId) return
    pollRef.current = setInterval(() => {
      void mergeNewest()
    }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [connectionId, mergeNewest])

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    sendMessage,
    loadMore,
    markRead,
  }
}
