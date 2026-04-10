import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConnections } from '../hooks/useConnections'
import { useAuth } from '../contexts/AuthContext'
import { useRealtime } from '../contexts/RealtimeContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'

interface ConversationPreview {
  connectionId: string
  partnerId: string
  partnerName: string
  partnerHeadline: string
  partnerAvatar: string | null
  lastMessageBody: string | null
  lastMessageAt: string | null
  lastMessageSenderId: string | null
  unreadCount: number
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

/**
 * Inbox: accepted connections as conversations, sorted by latest message.
 * Shows message preview, relative time, and unread indicator.
 */
export default function InboxPage() {
  const { user } = useAuth()
  const { connections, loading: connectionsLoading, getConnections } = useConnections()
  const { connectionsVersion, unreadMessageCount } = useRealtime()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConnections()
  }, [getConnections, connectionsVersion])

  const buildConversations = useCallback(async () => {
    if (!user || connectionsLoading) return

    const accepted = connections.filter(c => c.status === 'accepted')
    if (accepted.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    // Fetch the last message + unread count for each connection in parallel
    const previews = await Promise.all(
      accepted.map(async (conn) => {
        const partner = conn.sender_id === user.id ? conn.receiver : conn.sender
        if (!partner) return null

        // Get last message
        const { data: lastMsgRows } = await supabase
          .from('messages')
          .select('body, created_at, sender_id')
          .eq('connection_id', conn.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMsg = lastMsgRows?.[0] ?? null

        // Get unread count (messages from partner that I haven't read)
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('connection_id', conn.id)
          .neq('sender_id', user.id)
          .is('read_at', null)
          .is('deleted_at', null)

        return {
          connectionId: conn.id,
          partnerId: partner.id,
          partnerName: partner.full_name,
          partnerHeadline: partner.headline || '',
          partnerAvatar: partner.avatar_url,
          lastMessageBody: lastMsg?.body ?? null,
          lastMessageAt: lastMsg?.created_at ?? conn.responded_at ?? conn.created_at,
          lastMessageSenderId: lastMsg?.sender_id ?? null,
          unreadCount: count ?? 0,
        } as ConversationPreview
      })
    )

    // Filter nulls + sort by latest message (most recent first)
    const sorted = previews
      .filter((p): p is ConversationPreview => p !== null)
      .sort((a, b) => {
        const aTime = a.lastMessageAt || '0'
        const bTime = b.lastMessageAt || '0'
        return bTime.localeCompare(aTime)
      })

    setConversations(sorted)
    setLoading(false)
  }, [user, connections, connectionsLoading])

  // Build conversations when connections load or unread count changes
  useEffect(() => {
    void buildConversations()
  }, [buildConversations, unreadMessageCount])

  // Poll to keep previews fresh
  useEffect(() => {
    const interval = setInterval(() => {
      void buildConversations()
    }, 5000)
    return () => clearInterval(interval)
  }, [buildConversations])

  if (loading && conversations.length === 0 && connectionsLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="h-3 skeleton rounded w-14 mb-2" />
        <div className="h-10 skeleton rounded w-40 mb-10" />
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-5">
              <div className="w-10 h-10 rounded-full skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded w-36" />
                <div className="h-3 skeleton rounded w-52" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
        Inbox
      </p>
      <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-10">
        Messages
      </h1>

      {conversations.length === 0 && !loading ? (
        <EmptyState
          icon="◌"
          title="No conversations yet."
          description="Once you accept a connection request, you can start messaging here."
          action={{ label: 'Find people to connect with', onClick: () => navigate('/discover') }}
        />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {conversations.map(conv => (
            <li
              key={conv.connectionId}
              onClick={() => navigate(`/chat/${conv.connectionId}`)}
              className="flex items-center gap-4 py-5 cursor-pointer group"
            >
              <div className="relative flex-shrink-0">
                <Avatar src={conv.partnerAvatar} name={conv.partnerName} size="md" />
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] text-[10px] font-bold tabular-nums">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className={`font-display text-lg leading-tight truncate group-hover:text-[var(--accent-primary)] transition-colors ${
                    conv.unreadCount > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {conv.partnerName}
                  </p>
                  {conv.lastMessageAt && (
                    <span className="flex-shrink-0 font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] tabular-nums">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate ${
                  conv.unreadCount > 0
                    ? 'text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-tertiary)]'
                }`}>
                  {conv.lastMessageBody
                    ? (conv.lastMessageSenderId === user?.id ? 'You: ' : '') + conv.lastMessageBody
                    : conv.partnerHeadline || 'Start a conversation'}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
