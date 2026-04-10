import { useState, type KeyboardEvent } from 'react'

interface MessageComposerProps {
  onSend: (body: string) => Promise<{ error: string | null }>
  disabled?: boolean
  placeholder?: string
}

const MAX_LENGTH = 2000

export default function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Write a message…',
}: MessageComposerProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    const trimmed = body.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    setError(null)
    const { error: sendError } = await onSend(trimmed)
    if (sendError) {
      setError(sendError)
    } else {
      setBody('')
    }
    setSending(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const charsRemaining = MAX_LENGTH - body.length
  const nearLimit = charsRemaining < 100

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-primary)] p-4">
      {error && (
        <p className="text-xs text-[var(--danger)] mb-2">{error}</p>
      )}
      <div className="flex items-end gap-3">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={placeholder}
          aria-label="Message text"
          rows={1}
          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)] transition-colors max-h-32 disabled:opacity-50"
          style={{ minHeight: '44px' }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending || disabled}
          aria-label="Send message"
          className="px-5 py-3 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {nearLimit && (
        <p className="text-xs text-[var(--text-tertiary)] text-right mt-1 tabular-nums">
          {charsRemaining} characters left
        </p>
      )}
    </div>
  )
}
