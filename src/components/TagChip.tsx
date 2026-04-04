interface TagChipProps {
  label: string
  variant?: 'skill' | 'interest'
  onRemove?: () => void
}

export default function TagChip({ label, variant = 'skill', onRemove }: TagChipProps) {
  const base = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all'
  const styles = {
    skill: 'bg-[rgba(0,191,166,0.15)] text-[var(--accent-primary)] border border-[rgba(0,191,166,0.3)]',
    interest: 'bg-[rgba(255,107,107,0.15)] text-[var(--accent-secondary)] border border-[rgba(255,107,107,0.3)]',
  }

  return (
    <span className={`${base} ${styles[variant]}`}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity leading-none text-sm"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
