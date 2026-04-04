interface TagChipProps {
  label: string
  variant?: 'skill' | 'interest'
  onRemove?: () => void
}

export default function TagChip({ label, variant = 'skill', onRemove }: TagChipProps) {
  // Unified editorial look: hairline border, paper surface, pixel label.
  // The only visual difference between skill and interest is a leading middot.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 font-pixel text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
      {variant === 'interest' && <span className="text-[var(--text-tertiary)]">·</span>}
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 leading-none text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
