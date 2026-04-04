import { useState, useEffect } from 'react'
import { useConnections } from '../hooks/useConnections'
import ConnectionModal from './ConnectionModal'
import type { Profile } from '../types'

interface ConnectionButtonProps {
  targetUserId: string
  targetProfile?: Profile | null
  onStatusChange?: () => void
}

export default function ConnectionButton({ targetUserId, targetProfile, onStatusChange }: ConnectionButtonProps) {
  const { connections, getConnections, sendConnection, respondToConnection, getConnectionStatus } = useConnections()
  const [modalOpen, setModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    getConnections()
  }, [getConnections])

  const status = getConnectionStatus(targetUserId)
  const pendingConn = connections.find(c =>
    c.receiver_id === targetUserId || c.sender_id === targetUserId
  )

  const handleSend = async (message: string) => {
    setActionLoading(true)
    await sendConnection(targetUserId, message)
    await getConnections()
    setActionLoading(false)
    onStatusChange?.()
  }

  const handleRespond = async (connStatus: 'accepted' | 'declined') => {
    if (!pendingConn) return
    setActionLoading(true)
    await respondToConnection(pendingConn.id, connStatus)
    await getConnections()
    setActionLoading(false)
    onStatusChange?.()
  }

  if (status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(16,185,129,0.15)] text-[var(--success)] border border-[rgba(16,185,129,0.3)] text-sm font-semibold">
        <span>✓</span> Connected
      </span>
    )
  }

  if (status === 'pending_sent') {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--border)] text-sm font-medium">
        Request Sent
      </span>
    )
  }

  if (status === 'pending_received') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleRespond('accepted')}
          disabled={actionLoading}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => handleRespond('declined')}
          disabled={actionLoading}
          className="px-4 py-2 rounded-lg border border-[var(--danger)] text-[var(--danger)] font-medium hover:bg-[rgba(239,68,68,0.1)] transition-all text-sm disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={actionLoading}
        className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm disabled:opacity-50"
      >
        Connect
      </button>
      <ConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSend={handleSend}
        recipientName={targetProfile?.full_name || 'this person'}
      />
    </>
  )
}
