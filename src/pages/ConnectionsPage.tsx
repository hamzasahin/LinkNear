import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConnections } from '../hooks/useConnections'
import { useAuth } from '../contexts/AuthContext'
import type { Connection } from '../types'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'

type Tab = 'received' | 'sent' | 'connected'

export default function ConnectionsPage() {
  const { user } = useAuth()
  const { connections, loading, getConnections, respondToConnection } = useConnections()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('received')
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    getConnections()
  }, [getConnections])

  const received = connections.filter(c => c.receiver_id === user?.id && c.status === 'pending')
  const sent = connections.filter(c => c.sender_id === user?.id && c.status === 'pending')
  const connected = connections.filter(c => c.status === 'accepted')

  const handleRespond = async (conn: Connection, status: 'accepted' | 'declined') => {
    setResponding(conn.id)
    await respondToConnection(conn.id, status)
    await getConnections()
    setResponding(null)
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'received', label: 'Received', count: received.length },
    { id: 'sent', label: 'Sent', count: sent.length },
    { id: 'connected', label: 'Connected', count: connected.length },
  ]

  if (loading) return <LoadingSpinner message="Loading connections..." />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-3xl text-[var(--text-primary)] mb-6">Connections</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? 'bg-[rgba(0,0,0,0.2)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'received' && (
          received.length === 0
            ? <EmptyState icon="📬" title="No pending requests" description="When someone wants to connect with you, their request will appear here." />
            : received.map(conn => {
                const other = conn.sender
                if (!other) return null
                return (
                  <div
                    key={conn.id}
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4"
                  >
                    <div
                      className="flex items-start gap-3 mb-3 cursor-pointer"
                      onClick={() => navigate(`/profile/${other.id}`)}
                    >
                      <Avatar src={other.avatar_url} name={other.full_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] text-sm">{other.full_name}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{other.headline}</p>
                        {conn.message && (
                          <p className="text-xs text-[var(--text-secondary)] mt-2 italic bg-[var(--bg-surface-hover)] rounded-lg p-2 border border-[var(--border)]">
                            "{conn.message}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(conn, 'accepted')}
                        disabled={responding === conn.id}
                        className="flex-1 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {responding === conn.id ? '...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleRespond(conn, 'declined')}
                        disabled={responding === conn.id}
                        className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-medium text-sm hover:border-[var(--danger)] hover:text-[var(--danger)] transition-all disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )
              })
        )}

        {activeTab === 'sent' && (
          sent.length === 0
            ? <EmptyState
                icon="📤"
                title="No sent requests"
                description="You haven't sent any connection requests yet. Discover people nearby!"
                action={{ label: 'Discover people', onClick: () => navigate('/discover') }}
              />
            : sent.map(conn => {
                const other = conn.receiver
                if (!other) return null
                return (
                  <div
                    key={conn.id}
                    onClick={() => navigate(`/profile/${other.id}`)}
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--accent-primary)] transition-all"
                  >
                    <Avatar src={other.avatar_url} name={other.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-sm">{other.full_name}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">{other.headline}</p>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">Pending…</span>
                  </div>
                )
              })
        )}

        {activeTab === 'connected' && (
          connected.length === 0
            ? <EmptyState
                icon="🌐"
                title="No connections yet"
                description="Start exploring and connecting with people nearby!"
                action={{ label: 'Start exploring', onClick: () => navigate('/discover') }}
              />
            : connected.map(conn => {
                const other = conn.sender_id === user?.id ? conn.receiver : conn.sender
                if (!other) return null
                return (
                  <div
                    key={conn.id}
                    onClick={() => navigate(`/profile/${other.id}`)}
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--accent-primary)] transition-all"
                  >
                    <Avatar src={other.avatar_url} name={other.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-sm">{other.full_name}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">{other.headline}</p>
                    </div>
                    <span className="text-xs text-[var(--success)] font-medium flex-shrink-0">✓ Connected</span>
                  </div>
                )
              })
        )}
      </div>
    </div>
  )
}
