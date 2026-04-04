import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 text-center">
      <div className="animate-float text-8xl mb-6">🗺️</div>
      <h1 className="font-display text-5xl text-[var(--text-primary)] mb-3">You've wandered too far!</h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-sm">
        This page doesn't exist. Let's get you back to somewhere familiar.
      </p>
      <button
        onClick={() => navigate('/discover')}
        className="px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all"
      >
        ← Back to Discover
      </button>
      <p className="mt-4 text-xs text-[var(--text-tertiary)]">Error 404 — Page not found</p>
    </div>
  )
}
