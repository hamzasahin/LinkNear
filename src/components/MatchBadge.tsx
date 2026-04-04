interface MatchBadgeProps {
  score: number
}

export default function MatchBadge({ score }: MatchBadgeProps) {
  // Score rendered as Geist Mono numerals. A thin coral underline marks a
  // strong match (≥80); nothing else.
  const strong = score >= 80
  return (
    <span
      className={`font-pixel text-sm text-[var(--text-primary)] tabular-nums ${
        strong ? 'underline underline-offset-[3px] decoration-[var(--accent-primary)] decoration-1' : ''
      }`}
    >
      {score}%
    </span>
  )
}
