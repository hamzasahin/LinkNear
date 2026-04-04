import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 text-center">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-6">
        Error
      </p>
      <div className="font-pixel text-[clamp(5rem,14vw,10rem)] text-[var(--text-primary)] leading-none mb-8 tracking-tighter">
        404
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-[var(--text-primary)] mb-3 leading-tight">
        This page does not exist.
      </h1>
      <p className="text-[var(--text-tertiary)] text-sm max-w-sm mb-8">
        You have wandered past the edge of the map.
      </p>
      <button
        onClick={() => navigate('/discover')}
        className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
      >
        Back to Discover →
      </button>
    </div>
  )
}
