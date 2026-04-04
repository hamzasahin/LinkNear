interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-end gap-1.5 font-pixel text-xl text-[var(--text-primary)] leading-none">
        <span className="animate-pulse" style={{ animationDelay: '0ms' }}>·</span>
        <span className="animate-pulse" style={{ animationDelay: '250ms' }}>·</span>
        <span className="animate-pulse" style={{ animationDelay: '500ms' }}>·</span>
      </div>
      {message && (
        <p className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {message}
        </p>
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
