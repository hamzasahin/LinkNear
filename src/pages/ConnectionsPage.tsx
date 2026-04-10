import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConnections } from '../hooks/useConnections'
import { useAuth } from '../contexts/AuthContext'
import { useRealtime } from '../contexts/RealtimeContext'
import { useToast } from '../contexts/ToastContext'
import type { Connection } from '../types'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
// LoadingSpinner replaced by skeleton screens

type Tab = 'received' | 'sent' | 'connected'

export default function ConnectionsPage() {
  const { user } = useAuth()
  const {
    connections,
    loading,
    getConnections,
    respondToConnection,
    cancelRequest,
    disconnect,
  } = useConnections()
  const { connectionsVersion } = useRealtime()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('received')
  const [responding, setResponding] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    getConnections()
  }, [getConnections, connectionsVersion])

  const received = connections.filter(c => c.receiver_id === user?.id && c.status === 'pending')
  const sent = connections.filter(c => c.sender_id === user?.id && c.status === 'pending')
  const connected = connections.filter(c => c.status === 'accepted')

  const handleRespond = async (conn: Connection, accept: boolean) => {
    setResponding(conn.id)

    try {
      await respondToConnection(conn.id, accept)
      await getConnections()
      if (accept) {
        showToast('Connection accepted \u2014 you can now message each other', 'success')
      }
    } finally {
      setResponding(null)
    }
  }

  const handleCancel = async (conn: Connection) => {
    setActingId(conn.id)

    try {
      await cancelRequest(conn.id)
      await getConnections()
    } finally {
      setActingId(null)
    }
  }

  const handleDisconnect = async (conn: Connection) => {
    if (!window.confirm("Disconnect from this person? You won't be able to message each other anymore.")) return
    setActingId(conn.id)
    try {
      await disconnect(conn.id)
      await getConnections()
    } finally {
      setActingId(null)
    }
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'received', label: 'Received', count: received.length },
    { id: 'sent', label: 'Sent', count: sent.length },
    { id: 'connected', label: 'Connected', count: connected.length },
  ]

  if (loading) return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="h-3 skeleton rounded w-20 mb-2" />
      <div className="h-10 skeleton rounded w-48 mb-10" />
      <div className="flex gap-8 mb-8 border-b border-[var(--border-strong)] pb-3">
        <div className="h-4 skeleton rounded w-20" />
        <div className="h-4 skeleton rounded w-16" />
        <div className="h-4 skeleton rounded w-24" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-6">
            <div className="w-10 h-10 rounded-full skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton rounded w-40" />
              <div className="h-3 skeleton rounded w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
        Directory
      </p>
      <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-10">
        Connections
      </h1>

      {/* Tabs — underlined text, no pills */}
      <div className="flex items-center gap-8 border-b border-[var(--border-strong)] mb-8">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative pb-3 text-sm transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="ml-2 font-pixel text-[10px] tabular-nums text-[var(--text-tertiary)]">
                {tab.count.toString().padStart(2, '0')}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute left-0 right-0 -bottom-px h-px bg-[var(--accent-primary)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'received' && (
          received.length === 0
            ? <EmptyState icon="∅" title="No pending requests." description="When someone asks to connect, it will show up here." />
            : <ul className="divide-y divide-[var(--border)]">
                {received.map(conn => {
                  const other = conn.sender
                  if (!other) return null
                  return (
                    <li key={conn.id} className="py-6">
                      <div
                        className="flex items-start gap-4 cursor-pointer"
                        onClick={() => navigate(`/profile/${other.id}`)}
                      >
                        <Avatar src={other.avatar_url} name={other.full_name} size="md" revealed={true} />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-lg text-[var(--text-primary)] leading-tight">{other.full_name}</p>
                          <p className="text-sm text-[var(--text-tertiary)] truncate mt-0.5">{other.headline}</p>
                          {conn.message && (
                            <p className="font-display text-base text-[var(--text-secondary)] mt-3 italic leading-snug">
                              “{conn.message}”
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 mt-3 ml-14">
                        <button
                          onClick={() => handleRespond(conn, true)}
                          disabled={responding === conn.id}
                          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all"
                        >
                          {responding === conn.id ? 'Accepting…' : 'Accept →'}
                        </button>
                        <button
                          onClick={() => handleRespond(conn, false)}
                          disabled={responding === conn.id}
                          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
        )}

        {activeTab === 'sent' && (
          sent.length === 0
            ? <EmptyState
                icon="·"
                title="No outgoing requests."
                description="Find someone nearby and start a conversation."
                action={{ label: 'Discover people', onClick: () => navigate('/discover') }}
              />
            : <ul className="divide-y divide-[var(--border)]">
                {sent.map(conn => {
                  const other = conn.receiver
                  if (!other) return null
                  return (
                    <li key={conn.id} className="flex items-center gap-4 py-6 group">
                      <div
                        onClick={() => navigate(`/profile/${other.id}`)}
                        className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      >
                        <Avatar src={other.avatar_url} name={other.full_name} size="md" revealed={true} />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-lg text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent-primary)] transition-colors">
                            {other.full_name}
                          </p>
                          <p className="text-sm text-[var(--text-tertiary)] truncate mt-0.5">{other.headline}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                          Pending
                        </span>
                        <button
                          onClick={() => handleCancel(conn)}
                          disabled={actingId === conn.id}
                          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)] disabled:opacity-50 transition-colors"
                        >
                          {actingId === conn.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
        )}

        {activeTab === 'connected' && (
          connected.length === 0
            ? <EmptyState
                icon="◌"
                title="No connections yet."
                description="Discover people nearby and send a request."
                action={{ label: 'Discover people', onClick: () => navigate('/discover') }}
              />
            : <ul className="divide-y divide-[var(--border)]">
                {connected.map(conn => {
                  const other = conn.sender_id === user?.id ? conn.receiver : conn.sender
                  if (!other) return null
                  return (
                    <li key={conn.id} className="flex items-center gap-4 py-6 group">
                      <div
                        onClick={() => navigate(`/profile/${other.id}`)}
                        className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      >
                        <Avatar src={other.avatar_url} name={other.full_name} size="md" revealed={true} />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-lg text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent-primary)] transition-colors">
                            {other.full_name}
                          </p>
                          <p className="text-sm text-[var(--text-tertiary)] truncate mt-0.5">{other.headline}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <button
                          onClick={() => navigate(`/chat/${conn.id}`)}
                          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
                        >
                          Message →
                        </button>
                        <button
                          onClick={() => handleDisconnect(conn)}
                          disabled={actingId === conn.id}
                          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)] disabled:opacity-50 transition-colors"
                        >
                          {actingId === conn.id ? 'Working…' : 'Disconnect'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
        )}
      </div>
    </div>
  )
}
