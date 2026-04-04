interface MatchBadgeProps {
  score: number
}

export default function MatchBadge({ score }: MatchBadgeProps) {
  const color =
    score >= 80 ? 'bg-[rgba(16,185,129,0.2)] text-[var(--success)] border-[rgba(16,185,129,0.4)]' :
    score >= 50 ? 'bg-[rgba(255,179,71,0.2)] text-[var(--accent-tertiary)] border-[rgba(255,179,71,0.4)]' :
    'bg-[rgba(100,116,139,0.2)] text-[var(--text-tertiary)] border-[rgba(100,116,139,0.4)]'

  return (
    <div className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${color}`}>
      {score}%
    </div>
  )
}
