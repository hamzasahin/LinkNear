interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-10 h-10 rounded-full border-2 border-[var(--border)] border-t-[var(--accent-primary)] animate-spin"
      />
      {message && (
        <p className="text-[var(--text-secondary)] text-sm">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-[var(--bg-primary)] flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-12">
      {content}
    </div>
  )
}
