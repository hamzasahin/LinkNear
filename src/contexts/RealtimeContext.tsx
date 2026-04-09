/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface RealtimeContextType {
  pendingReceivedCount: number
  unreadMessageCount: number
  /** Monotonically increasing counter that consumers can watch to refetch. */
  connectionsVersion: number
  /** Monotonically increasing counter scoped per connection_id. */
  getMessagesVersion: (connectionId: string) => number
  /** Force-refresh both counters (e.g. after a manual action). */
  refresh: () => void
}

const RealtimeContext = createContext<RealtimeContextType | null>(null)

/**
 * Owns all Supabase Realtime subscriptions for the authenticated session.
 *
 * Two logical channels:
 *   1. connections:{user_id} — INSERT/UPDATE/DELETE on the connections table
 *      for rows where the user is sender or receiver. Drives the nav badge
 *      ("pendingReceivedCount") and triggers connection-list refetches across
 *      pages via `connectionsVersion`.
 *   2. messages:{user_id} — INSERT/UPDATE on messages for the user's accepted
 *      connections. Drives unread badge and ChatPage live updates via
 *      `messagesVersion` map.
 *
 * Pages subscribe to version counters (not raw events) so a single source of
 * truth owns the channels and pages stay thin.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [pendingReceivedCount, setPendingReceivedCount] = useState(0)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [connectionsVersion, setConnectionsVersion] = useState(0)
  const [messagesVersions, setMessagesVersions] = useState<Record<string, number>>({})

  const userRef = useRef(user)
  userRef.current = user

  const refreshCounts = useCallback(async () => {
    const u = userRef.current
    if (!u) return

    // Pending received requests
    const { count: pending } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', u.id)
      .eq('status', 'pending')
    setPendingReceivedCount(pending ?? 0)

    // Unread messages in any of my accepted connections, not sent by me
    const { count: unread } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .neq('sender_id', u.id)
      .is('read_at', null)
      .is('deleted_at', null)
    setUnreadMessageCount(unread ?? 0)
  }, [])

  useEffect(() => {
    if (!user) {
      setPendingReceivedCount(0)
      setUnreadMessageCount(0)
      setConnectionsVersion(0)
      setMessagesVersions({})
      return
    }

    refreshCounts()

    const channels: RealtimeChannel[] = []

    // Connections where I'm receiver — notifies on new incoming requests
    const connectionsReceiverChannel = supabase
      .channel(`conn-receiver-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setConnectionsVersion(v => v + 1)
          refreshCounts()
        }
      )
      .subscribe()
    channels.push(connectionsReceiverChannel)

    // Connections where I'm sender — notifies on accept/decline/cancel
    const connectionsSenderChannel = supabase
      .channel(`conn-sender-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          setConnectionsVersion(v => v + 1)
          refreshCounts()
        }
      )
      .subscribe()
    channels.push(connectionsSenderChannel)

    // Messages — RLS ensures we only see messages from our own accepted
    // conversations, so a wildcard subscription is safe.
    const messagesChannel = supabase
      .channel(`messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload: { new?: { connection_id?: string }; old?: { connection_id?: string } }) => {
          const newRow = payload.new
          const oldRow = payload.old
          const connId = newRow?.connection_id || oldRow?.connection_id
          if (connId) {
            setMessagesVersions(prev => ({ ...prev, [connId]: (prev[connId] ?? 0) + 1 }))
          }
          refreshCounts()
        }
      )
      .subscribe()
    channels.push(messagesChannel)

    return () => {
      channels.forEach(ch => {
        supabase.removeChannel(ch)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const value = useMemo<RealtimeContextType>(
    () => ({
      pendingReceivedCount,
      unreadMessageCount,
      connectionsVersion,
      getMessagesVersion: (connectionId: string) => messagesVersions[connectionId] ?? 0,
      refresh: refreshCounts,
    }),
    [pendingReceivedCount, unreadMessageCount, connectionsVersion, messagesVersions, refreshCounts]
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(): RealtimeContextType {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    // Tolerate usage outside the provider (e.g. landing page) with inert defaults.
    return {
      pendingReceivedCount: 0,
      unreadMessageCount: 0,
      connectionsVersion: 0,
      getMessagesVersion: () => 0,
      refresh: () => {},
    }
  }
  return ctx
}
