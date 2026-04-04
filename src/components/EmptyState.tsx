import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="font-pixel text-3xl text-[var(--text-faint)] mb-6">{icon}</div>
      )}
      <h3 className="font-display text-2xl text-[var(--text-primary)] mb-3 leading-tight">{title}</h3>
      <p className="text-[var(--text-tertiary)] text-sm max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          {action.label} →
        </button>
      )}
    </div>
  )
}
