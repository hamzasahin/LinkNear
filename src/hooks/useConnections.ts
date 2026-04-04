import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Connection } from '../types'
import { useAuth } from '../contexts/AuthContext'

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'

interface UseConnectionsReturn {
  connections: Connection[]
  loading: boolean
  error: string | null
  sendConnection: (receiverId: string, message?: string) => Promise<{ error: string | null }>
  getConnections: () => Promise<void>
  respondToConnection: (connectionId: string, status: 'accepted' | 'declined') => Promise<{ error: string | null }>
  getConnectionStatus: (otherUserId: string) => ConnectionStatus
}

export function useConnections(): UseConnectionsReturn {
  const { user } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const sendConnection = async (receiverId: string, message?: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('connections')
      .insert({ sender_id: user.id, receiver_id: receiverId, message: message || null })

    return { error: error?.message || null }
  }

  const respondToConnection = async (connectionId: string, status: 'accepted' | 'declined'): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('connections')
      .update({ status })
      .eq('id', connectionId)

    if (!error) {
      setConnections(prev =>
        prev.map(c => c.id === connectionId ? { ...c, status } : c)
      )
    }

    return { error: error?.message || null }
  }

  const getConnectionStatus = (otherUserId: string): ConnectionStatus => {
    if (!user) return 'none'
    const conn = connections.find(c =>
      (c.sender_id === user.id && c.receiver_id === otherUserId) ||
      (c.receiver_id === user.id && c.sender_id === otherUserId)
    )
    if (!conn) return 'none'
    if (conn.status === 'accepted') return 'accepted'
    if (conn.status === 'declined') return 'declined'
    if (conn.sender_id === user.id) return 'pending_sent'
    return 'pending_received'
  }

  return { connections, loading, error, sendConnection, getConnections, respondToConnection, getConnectionStatus }
}
