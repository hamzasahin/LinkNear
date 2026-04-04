import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Connection } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { rpcWithRetry } from '../lib/rpcRetry'

export type ConnectionStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'blocked'

interface UseConnectionsReturn {
  connections: Connection[]
  loading: boolean
  error: string | null
  sendConnection: (receiverId: string, message?: string) => Promise<{ error: string | null }>
  getConnections: () => Promise<void>
  respondToConnection: (connectionId: string, accept: boolean) => Promise<{ error: string | null }>
  cancelRequest: (connectionId: string) => Promise<{ error: string | null }>
  disconnect: (connectionId: string) => Promise<{ error: string | null }>
  getConnectionStatus: (otherUserId: string) => ConnectionStatus
}

export function useConnections(): UseConnectionsReturn {
  const { user } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Prevent double-click races on send.
  const inFlightSends = useRef<Set<string>>(new Set())

  const getConnections = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('connections')
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setConnections((data || []) as Connection[])
    }
    setLoading(false)
  }, [user])

  const sendConnection = async (
    receiverId: string,
    message?: string
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    if (inFlightSends.current.has(receiverId)) {
      return { error: 'Request already in flight' }
    }
    inFlightSends.current.add(receiverId)

    try {
      await rpcWithRetry(() =>
        supabase.rpc('send_connection_request', {
          p_receiver: receiverId,
          p_message: message ?? null,
        })
      )
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    } finally {
      inFlightSends.current.delete(receiverId)
    }
  }

  const respondToConnection = async (
    connectionId: string,
    accept: boolean
  ): Promise<{ error: string | null }> => {
    try {
      await rpcWithRetry(() =>
        supabase.rpc('respond_to_connection', {
          p_connection_id: connectionId,
          p_accept: accept,
        })
      )
      const newStatus: Connection['status'] = accept ? 'accepted' : 'declined'
      setConnections(prev => prev.map(c => (c.id === connectionId ? { ...c, status: newStatus } : c)))
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const cancelRequest = async (connectionId: string): Promise<{ error: string | null }> => {
    try {
      await rpcWithRetry(() =>
        supabase.rpc('cancel_connection_request', { p_connection_id: connectionId })
      )
      setConnections(prev => prev.map(c => (c.id === connectionId ? { ...c, status: 'cancelled' } : c)))
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const disconnect = async (connectionId: string): Promise<{ error: string | null }> => {
    try {
      await rpcWithRetry(() =>
        supabase.rpc('disconnect_connection', { p_connection_id: connectionId })
      )
      setConnections(prev => prev.map(c => (c.id === connectionId ? { ...c, status: 'cancelled' } : c)))
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const getConnectionStatus = (otherUserId: string): ConnectionStatus => {
    if (!user) return 'none'
    const conn = connections.find(
      c =>
        (c.sender_id === user.id && c.receiver_id === otherUserId) ||
        (c.receiver_id === user.id && c.sender_id === otherUserId)
    )
    if (!conn) return 'none'
    if (conn.status === 'accepted') return 'accepted'
    if (conn.status === 'declined') return 'declined'
    if (conn.status === 'cancelled') return 'cancelled'
    if (conn.status === 'blocked') return 'blocked'
    if (conn.status === 'pending' && conn.sender_id === user.id) return 'pending_sent'
    if (conn.status === 'pending') return 'pending_received'
    return 'none'
  }

  return {
    connections,
    loading,
    error,
    sendConnection,
    getConnections,
    respondToConnection,
    cancelRequest,
    disconnect,
    getConnectionStatus,
  }
}
