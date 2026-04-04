import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="text-5xl mb-4 opacity-60">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm max-w-xs mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold rounded-lg hover:opacity-90 transition-all text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
