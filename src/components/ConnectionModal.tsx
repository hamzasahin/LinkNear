import { useState, useEffect } from 'react'

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string) => Promise<void>
  recipientName: string
}

export default function ConnectionModal({ isOpen, onClose, onSend, recipientName }: ConnectionModalProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!isOpen) setMessage('')
  }, [isOpen])

  if (!isOpen) return null

  const handleSend = async () => {
    setSending(true)
    await onSend(message)
    setSending(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl p-6 animate-fade-in-up">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
          Connect with {recipientName}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Add a short intro message to increase your chances of connecting.
        </p>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Hi! I noticed we share interests in..."
          rows={4}
          maxLength={300}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
        />
        <p className="text-xs text-[var(--text-tertiary)] text-right mt-1">{message.length}/300</p>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface-hover)] transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 py-2.5 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
