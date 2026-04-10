import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import type { Connection, Profile } from '../types'
import Avatar from '../components/Avatar'
import MessageBubble from '../components/MessageBubble'
import MessageComposer from '../components/MessageComposer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ChatPage() {
  const { connectionId } = useParams<{ connectionId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [connection, setConnection] = useState<Connection | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const { messages, loading, loadingMore, hasMore, error, sendMessage, loadMore, markRead } =
    useMessages(connectionId)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Track whether the user is near the bottom so we auto-scroll on new messages
  // but not when they've scrolled up to read history.
  const nearBottomRef = useRef(true)
  // Anchor loadMore scroll: save previous height to preserve scroll position.
  const prevHeightRef = useRef<number | null>(null)

  // Load the connection row so we can show the partner's profile in the header.
  useEffect(() => {
    if (!connectionId) return
    let cancelled = false
    setConnectionLoading(true)
    setConnectionError(null)

    supabase
      .from('connections')
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .eq('id', connectionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setConnectionError(error.message)
        } else if (!data) {
          setConnectionError('Conversation not found')
        } else if (data.status !== 'accepted') {
          setConnectionError('This conversation is not available')
        } else {
          setConnection(data as Connection)
        }
        setConnectionLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [connectionId])

  const partner: Profile | null = useMemo(() => {
    if (!connection || !user) return null
    return connection.sender_id === user.id
      ? (connection.receiver as Profile)
      : (connection.sender as Profile)
  }, [connection, user])

  // Mark incoming messages as read whenever the chat is open and messages change.
  useEffect(() => {
    if (!connectionId || connectionLoading || connectionError) return
    void markRead()
  }, [connectionId, connectionLoading, connectionError, markRead, messages.length])

  // Also mark read when the window regains focus (user tabs back to the chat).
  useEffect(() => {
    if (!connectionId || connectionLoading || connectionError) return
    const handleFocus = () => { void markRead() }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void markRead()
    })
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [connectionId, connectionLoading, connectionError, markRead])

  // Auto-scroll to bottom on new messages (only when user is already at/near the bottom).
  useEffect(() => {
    if (prevHeightRef.current !== null && scrollContainerRef.current) {
      // We were loading older messages — keep the old message that was
      // previously at the top of the viewport anchored by adjusting scrollTop.
      const container = scrollContainerRef.current
      const newHeight = container.scrollHeight
      container.scrollTop = newHeight - prevHeightRef.current
      prevHeightRef.current = null
      return
    }
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottomRef.current = distanceFromBottom < 120

    // Near the top: trigger load more (and remember scroll height to preserve position).
    if (el.scrollTop < 80 && hasMore && !loadingMore && !loading) {
      prevHeightRef.current = el.scrollHeight
      void loadMore()
    }
  }

  if (connectionLoading) {
    return <LoadingSpinner fullScreen message="Opening conversation..." />
  }

  if (connectionError || !partner) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
          Unavailable
        </p>
        <h2 className="font-display text-3xl text-[var(--text-primary)] mb-4">
          This conversation is unavailable.
        </h2>
        {connectionError && (
          <p className="text-sm text-[var(--text-tertiary)] mb-6">{connectionError}</p>
        )}
        <button
          onClick={() => navigate('/connections')}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 hover:decoration-[2px]"
        >
          Back to connections →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-60px)] max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-primary)]">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <Link to={`/profile/${partner.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
          <Avatar src={partner.avatar_url} name={partner.full_name} size="md" revealed={true} />
          <div className="min-w-0">
            <p className="font-display text-lg text-[var(--text-primary)] leading-tight truncate group-hover:text-[var(--accent-primary)] transition-colors">
              {partner.full_name}
            </p>
            {partner.headline && (
              <p className="text-xs text-[var(--text-tertiary)] truncate">{partner.headline}</p>
            )}
          </div>
        </Link>
      </header>

      {/* Messages scroll area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {loadingMore && (
          <p className="text-center font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-4">
            Loading older messages…
          </p>
        )}

        {loading && messages.length === 0 && (
          <p className="text-center text-sm text-[var(--text-tertiary)]">Loading…</p>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center mt-20">
            <p className="font-display text-xl text-[var(--text-primary)] mb-2">
              Say hi to {partner.full_name.split(' ')[0]}.
            </p>
            <p className="text-sm text-[var(--text-tertiary)]">
              This is the beginning of your conversation.
            </p>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-[var(--danger)]">{error}</p>
        )}

        {messages.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.sender_id === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <MessageComposer onSend={sendMessage} placeholder={`Message ${partner.full_name.split(' ')[0]}…`} />
    </div>
  )
}
