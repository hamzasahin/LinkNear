import { useState } from 'react'
import type { Challenge, UserChallenge } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  kindness: 'Kindness',
  knowledge: 'Knowledge',
  community: 'Community',
  self: 'Self',
  generosity: 'Generosity',
  gratitude: 'Gratitude',
}

interface ChallengeCardProps {
  userChallenge: UserChallenge & { challenge: Challenge }
  streakCount: number
  onComplete: (reflection?: string, shareToFeed?: boolean) => Promise<{ pointsEarned: number; streakBonus: boolean } | null>
}

export default function ChallengeCard({ userChallenge, streakCount, onComplete }: ChallengeCardProps) {
  const { challenge } = userChallenge
  const [completed, setCompleted] = useState(userChallenge.completed)
  const [completing, setCompleting] = useState(false)
  const [showReflection, setShowReflection] = useState(false)
  const [reflection, setReflection] = useState(userChallenge.reflection || '')
  const [shareToFeed, setShareToFeed] = useState(false)
  const [result, setResult] = useState<{ pointsEarned: number; streakBonus: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)
    const res = await onComplete()
    if (res) {
      setResult(res)
      setCompleted(true)
      setShowReflection(true)
    }
    setCompleting(false)
  }

  const handleSaveReflection = async () => {
    setSaving(true)
    await onComplete(reflection, shareToFeed)
    setSaving(false)
  }

  return (
    <div
      className={`border rounded-[var(--radius-md)] p-6 mb-8 transition-colors ${
        completed
          ? 'border-[var(--success)] bg-[#4a7c5908]'
          : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-[10px] uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
            Today's Challenge
          </span>
          <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            {CATEGORY_LABELS[challenge.category] || challenge.category}
          </span>
        </div>
        {streakCount > 0 && (
          <span className="font-pixel text-[11px] tracking-[0.1em] text-[var(--accent-primary)]">
            Day {streakCount}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-display text-2xl text-[var(--text-primary)] leading-tight mb-3">
        "{challenge.title}"
      </h3>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
        {challenge.description}
      </p>

      {/* Source quote */}
      {challenge.source_text && (
        <div className="border-t border-[var(--border)] pt-4 mb-5">
          <p className="font-display text-sm italic text-[var(--text-tertiary)] leading-relaxed mb-1">
            "{challenge.source_text}"
          </p>
          {challenge.source && (
            <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              — {challenge.source}
            </p>
          )}
        </div>
      )}

      {/* Action area */}
      {!completed ? (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all disabled:opacity-50"
        >
          {completing ? 'Marking...' : 'I did this today →'}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Points earned */}
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--success)]">
              Completed
            </span>
            {result && (
              <span className="font-pixel text-[11px] tracking-[0.1em] text-[var(--text-tertiary)]">
                +{result.pointsEarned}{result.streakBonus ? ' (streak bonus!)' : ''}
              </span>
            )}
          </div>

          {/* Reflection area */}
          {showReflection && (
            <div className="space-y-3">
              <textarea
                value={reflection}
                onChange={e => setReflection(e.target.value)}
                placeholder="How did it go? (optional)"
                rows={3}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors resize-none"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareToFeed}
                    onChange={e => setShareToFeed(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    Share to feed
                  </span>
                </label>

                <button
                  onClick={handleSaveReflection}
                  disabled={saving}
                  className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
