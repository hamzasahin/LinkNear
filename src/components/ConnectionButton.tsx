import { useState, useEffect } from 'react'
import { useConnections } from '../hooks/useConnections'
import ConnectionModal from './ConnectionModal'

interface ConnectionButtonProps {
  targetUserId: string
  targetProfileName?: string
  onStatusChange?: () => void
}

export default function ConnectionButton({ targetUserId, targetProfileName, onStatusChange }: ConnectionButtonProps) {
  const {
    connections,
    getConnections,
    sendConnection,
    respondToConnection,
    cancelRequest,
    getConnectionStatus,
  } = useConnections()
  const [modalOpen, setModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    getConnections()
  }, [getConnections])

  const status = getConnectionStatus(targetUserId)
  const pendingConn = connections.find(c =>
    c.receiver_id === targetUserId || c.sender_id === targetUserId
  )

  const handleSend = async (message: string) => {
    setActionLoading(true)
    setActionError(null)
    const { error } = await sendConnection(targetUserId, message)
    if (error) setActionError(error)
    await getConnections()
    setActionLoading(false)
    onStatusChange?.()
  }

  const handleRespond = async (accept: boolean) => {
    if (!pendingConn) return
    setActionLoading(true)
    setActionError(null)
    const { error } = await respondToConnection(pendingConn.id, accept)
    if (error) setActionError(error)
    await getConnections()
    setActionLoading(false)
    onStatusChange?.()
  }

  const handleCancel = async () => {
    if (!pendingConn) return
    setActionLoading(true)
    setActionError(null)
    const { error } = await cancelRequest(pendingConn.id)
    if (error) setActionError(error)
    await getConnections()
    setActionLoading(false)
    onStatusChange?.()
  }

  if (status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-2 font-pixel text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        <span aria-hidden>·</span> Connected
      </span>
    )
  }

  if (status === 'pending_sent') {
    return (
      <div className="flex items-center gap-4 text-sm">
        <span className="font-pixel text-[11px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          · Request sent
        </span>
        <button
          onClick={handleCancel}
          disabled={actionLoading}
          className="text-[var(--text-tertiary)] hover:text-[var(--danger)] disabled:opacity-50 transition-colors text-xs"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === 'pending_received') {
    return (
      <div>
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => handleRespond(true)}
            disabled={actionLoading}
            className="text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all"
          >
            Accept →
          </button>
          <button
            onClick={() => handleRespond(false)}
            disabled={actionLoading}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
        </div>
        {actionError && <p className="text-xs text-[var(--danger)] mt-1">{actionError}</p>}
      </div>
    )
  }

  return (
    <>
      <div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={actionLoading}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all"
        >
          {actionLoading ? 'Sending…' : 'Connect →'}
        </button>
        {actionError && <p className="text-xs text-[var(--danger)] mt-1">{actionError}</p>}
      </div>
      <ConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSend={handleSend}
        recipientName={targetProfileName || 'this person'}
      />
    </>
  )
}
