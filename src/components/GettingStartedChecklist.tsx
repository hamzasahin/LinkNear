import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../types'

const STORAGE_KEY = 'linknear_checklist_dismissed'

interface ChecklistItem {
  key: string
  label: string
  done: boolean
  action?: () => void
}

interface GettingStartedChecklistProps {
  profile: Profile
  challengeCompletedToday: boolean
}

export default function GettingStartedChecklist({
  profile,
  challengeCompletedToday,
}: GettingStartedChecklistProps) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [autoHidden, setAutoHidden] = useState(false)

  const items: ChecklistItem[] = [
    {
      key: 'profile',
      label: 'Create your profile',
      done: !!profile.full_name,
    },
    {
      key: 'skills',
      label: 'Add at least 3 skills',
      done: (profile.skills?.length ?? 0) >= 3,
      action: () => navigate('/settings'),
    },
    {
      key: 'interests',
      label: 'Add at least 2 interests',
      done: (profile.interests?.length ?? 0) >= 2,
      action: () => navigate('/settings'),
    },
    {
      key: 'location',
      label: 'Set your location',
      done: profile.latitude != null,
      action: () => navigate('/settings'),
    },
    {
      key: 'challenge',
      label: "Complete today's challenge",
      done: challengeCompletedToday,
      action: () => {
        const el = document.getElementById('daily-challenge')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      },
    },
    {
      key: 'quiz',
      label: 'Take the character quiz (optional)',
      done: !!profile.quiz_completed,
      action: () => navigate('/quiz'),
    },
  ]

  const allDone = items.every(i => i.done)

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => setAutoHidden(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [allDone])

  if (dismissed || autoHidden) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* noop */ }
  }

  return (
    <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-6 mb-8">
      {allDone ? (
        <p className="font-display text-xl text-[var(--text-primary)]">
          You're all set!
        </p>
      ) : (
        <>
          <p className="font-pixel text-[10px] uppercase tracking-[0.15em] text-[var(--accent-primary)] mb-1">
            Welcome
          </p>
          <h2 className="font-display text-xl text-[var(--text-primary)] mb-5">
            Get the most out of LinkNear
          </h2>

          <ul className="space-y-3 mb-6">
            {items.map(item => (
              <li key={item.key} className="flex items-center gap-3">
                <span
                  className={`flex-shrink-0 text-sm ${
                    item.done
                      ? 'text-[var(--success)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {item.done ? '\u2713' : '\u25CB'}
                </span>
                {item.done ? (
                  <span className="text-sm text-[var(--text-tertiary)]">
                    {item.label}
                  </span>
                ) : item.action ? (
                  <button
                    onClick={item.action}
                    className="text-sm text-[var(--text-primary)] underline underline-offset-4 decoration-[var(--border-strong)] hover:decoration-[var(--accent-primary)] transition-colors text-left"
                  >
                    {item.label} &rarr;
                  </button>
                ) : (
                  <span className="text-sm text-[var(--text-primary)]">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <button
            onClick={handleDismiss}
            className="text-sm text-[var(--text-tertiary)] underline underline-offset-4 decoration-[var(--border-strong)] hover:decoration-[var(--text-tertiary)] transition-colors"
          >
            Dismiss checklist
          </button>
        </>
      )}
    </div>
  )
}
