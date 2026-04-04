import { useState } from 'react'

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string) => Promise<void>
  recipientName: string
}

export default function ConnectionModal({ isOpen, onClose, onSend, recipientName }: ConnectionModalProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setMessage('')
    setSending(false)
    onClose()
  }

  const handleSend = async () => {
    setSending(true)

    try {
      await onSend(message)
      setMessage('')
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--night-bg)]/50 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-[var(--radius-xl)] border border-[var(--border-strong)] p-8 animate-fade-in">
        <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
          Connect
        </p>
        <h3 className="font-display text-2xl text-[var(--text-primary)] mb-2 leading-tight">
          Introduce yourself to {recipientName}.
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] mb-5">
          A short note goes further than a blank request.
        </p>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Hi! I noticed we share interests in…"
          rows={4}
          maxLength={300}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
        />
        <p className="font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] text-right mt-1.5">
          {message.length}/300
        </p>

        <div className="flex items-center justify-end gap-6 mt-5">
          <button
            onClick={handleClose}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all"
          >
            {sending ? 'Sending…' : 'Send request →'}
          </button>
        </div>
      </div>
    </div>
  )
}
