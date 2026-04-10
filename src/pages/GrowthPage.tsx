import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGrowth } from '../hooks/useGrowth'
import type { Profile } from '../types'
import type { ChallengeDay, CategoryStat } from '../hooks/useGrowth'
import LoadingSpinner from '../components/LoadingSpinner'

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------
interface Milestone {
  id: string
  label: string
  check: (p: Profile) => boolean
  progress?: (p: Profile) => string
}

const MILESTONES: Milestone[] = [
  {
    id: 'first',
    label: 'First challenge completed',
    check: (p) => (p.challenges_completed || 0) >= 1,
  },
  {
    id: 'streak_7',
    label: '7-day streak',
    check: (p) => (p.longest_streak || 0) >= 7,
    progress: (p) => {
      const have = p.longest_streak || 0
      return have < 7 ? `${7 - have} more days` : ''
    },
  },
  {
    id: 'challenges_10',
    label: '10 challenges completed',
    check: (p) => (p.challenges_completed || 0) >= 10,
    progress: (p) => {
      const have = p.challenges_completed || 0
      return have < 10 ? `${10 - have} more` : ''
    },
  },
  {
    id: 'challenges_25',
    label: '25 challenges completed',
    check: (p) => (p.challenges_completed || 0) >= 25,
    progress: (p) => {
      const have = p.challenges_completed || 0
      return have < 25 ? `${25 - have} more` : ''
    },
  },
  {
    id: 'streak_30',
    label: '30-day streak',
    check: (p) => (p.longest_streak || 0) >= 30,
    progress: (p) => {
      const have = p.longest_streak || 0
      return have < 30 ? `${30 - have} more days` : ''
    },
  },
  {
    id: 'challenges_100',
    label: '100 challenges completed',
    check: (p) => (p.challenges_completed || 0) >= 100,
    progress: (p) => {
      const have = p.challenges_completed || 0
      return have < 100 ? `${100 - have} more` : ''
    },
  },
  {
    id: 'streak_100',
    label: '100-day streak',
    check: (p) => (p.longest_streak || 0) >= 100,
    progress: (p) => {
      const have = p.longest_streak || 0
      return have < 100 ? `${100 - have} more days` : ''
    },
  },
  {
    id: 'points_500',
    label: '500 total points',
    check: (p) => (p.total_points || 0) >= 500,
    progress: (p) => {
      const have = p.total_points || 0
      return have < 500 ? `${500 - have} more points` : ''
    },
  },
]

// ---------------------------------------------------------------------------
// Heatmap helpers
// ---------------------------------------------------------------------------
function buildHeatmapData(history: ChallengeDay[]): Map<string, 'completed' | 'assigned' | 'none'> {
  const map = new Map<string, 'completed' | 'assigned' | 'none'>()
  for (const day of history) {
    const existing = map.get(day.assigned_date)
    if (day.completed || existing !== 'completed') {
      map.set(day.assigned_date, day.completed ? 'completed' : 'assigned')
    }
  }
  return map
}

function getHeatmapDays(): string[] {
  const days: string[] = []
  const today = new Date()
  // Go back to the most recent Monday, then back 11 more weeks
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const endMonday = new Date(today)
  endMonday.setDate(today.getDate() - mondayOffset)

  const startDate = new Date(endMonday)
  startDate.setDate(endMonday.getDate() - 11 * 7)

  for (let i = 0; i < 84; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }

  // Add remaining days of current week
  const currentDay = new Date(startDate)
  currentDay.setDate(startDate.getDate() + 84)
  while (currentDay <= today) {
    days.push(currentDay.toISOString().split('T')[0])
    currentDay.setDate(currentDay.getDate() + 1)
  }

  return days
}

function getMonthLabels(days: string[]): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let lastMonth = -1

  for (let i = 0; i < days.length; i += 7) {
    const d = new Date(days[i] + 'T00:00:00')
    const month = d.getMonth()
    if (month !== lastMonth) {
      labels.push({ label: months[month], col: Math.floor(i / 7) })
      lastMonth = month
    }
  }
  return labels
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] px-4 py-5 text-center flex-1 min-w-0">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="font-display text-3xl text-[var(--text-primary)]">{value}</div>
      <div className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mt-1">
        {label}
      </div>
    </div>
  )
}

function HeatmapCalendar({ history }: { history: ChallengeDay[] }) {
  const heatmap = useMemo(() => buildHeatmapData(history), [history])
  const days = useMemo(() => getHeatmapDays(), [])
  const monthLabels = useMemo(() => getMonthLabels(days), [days])
  const numWeeks = Math.ceil(days.length / 7)

  // Build a grid: 7 rows x N columns
  const grid: (string | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: numWeeks }, () => null)
  )

  for (let i = 0; i < days.length; i++) {
    const col = Math.floor(i / 7)
    const row = i % 7
    grid[row][col] = days[i]
  }

  const cellColor = (dateStr: string | null) => {
    if (!dateStr) return 'bg-transparent'
    const status = heatmap.get(dateStr) || 'none'
    if (status === 'completed') return 'bg-[var(--success)]'
    if (status === 'assigned') return 'bg-[var(--border)]'
    return 'bg-[var(--bg-surface)]'
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Month labels */}
      <div className="flex mb-1 ml-0" style={{ gap: 0 }}>
        {Array.from({ length: numWeeks }, (_, col) => {
          const match = monthLabels.find((m) => m.col === col)
          return (
            <div
              key={col}
              className="font-pixel text-[9px] text-[var(--text-tertiary)] uppercase tracking-[0.08em]"
              style={{ width: 14, textAlign: 'left' }}
            >
              {match ? match.label : ''}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex flex-col" style={{ gap: 2 }}>
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex" style={{ gap: 2 }}>
            {row.map((dateStr, colIdx) => (
              <div
                key={colIdx}
                className={`rounded-[2px] ${cellColor(dateStr)} ${
                  dateStr === today ? 'ring-1 ring-[var(--accent-primary)]' : ''
                }`}
                style={{ width: 12, height: 12 }}
                title={dateStr || ''}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="font-pixel text-[9px] text-[var(--text-tertiary)] mt-2">
        Last 12 weeks — green = completed day
      </p>
    </div>
  )
}

function CategoryBars({ stats }: { stats: CategoryStat[] }) {
  const maxCount = stats.length > 0 ? stats[0].count : 1

  if (stats.length === 0) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        Complete challenges to see where you are growing.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {stats.map((stat, idx) => {
        const pct = Math.max(10, (stat.count / maxCount) * 100)
        return (
          <div key={stat.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[var(--text-primary)] capitalize">{stat.category}</span>
              <span className="font-pixel text-[10px] text-[var(--text-tertiary)]">
                {stat.count}
                {idx === 0 ? ' · your focus' : ''}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: idx === 0 ? 'var(--success)' : 'var(--border-strong)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MilestonesSection({
  profile,
  allCategories,
}: {
  profile: Profile
  allCategories: Set<string>
}) {
  const allCats = ['kindness', 'knowledge', 'community', 'self', 'generosity', 'gratitude']
  const missingCats = allCats.filter((c) => !allCategories.has(c))
  const allCategoriesTried = missingCats.length === 0

  return (
    <div className="space-y-3">
      {MILESTONES.map((m) => {
        const achieved = m.check(profile)
        const progressText = !achieved && m.progress ? m.progress(profile) : ''
        return (
          <div key={m.id} className="flex items-start gap-3">
            <span
              className={`flex-shrink-0 mt-0.5 text-sm ${
                achieved ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
              }`}
            >
              {achieved ? '\u2713' : '\u25CB'}
            </span>
            <span className="text-sm">
              <span
                className={
                  achieved ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                }
              >
                {m.label}
              </span>
              {progressText && (
                <span className="text-[var(--text-tertiary)] ml-1">({progressText})</span>
              )}
            </span>
          </div>
        )
      })}

      {/* All 6 categories milestone */}
      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 mt-0.5 text-sm ${
            allCategoriesTried ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
          }`}
        >
          {allCategoriesTried ? '\u2713' : '\u25CB'}
        </span>
        <span className="text-sm">
          <span
            className={
              allCategoriesTried ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
            }
          >
            All 6 categories tried
          </span>
          {!allCategoriesTried && missingCats.length > 0 && (
            <span className="text-[var(--text-tertiary)] ml-1">
              (need: {missingCats.join(', ')})
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border-strong)] pt-8 mt-8">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-5">
        {label}
      </p>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function GrowthPage() {
  const { user } = useAuth()
  const { getGrowthData, ALL_CATEGORIES } = useGrowth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [challengeHistory, setChallengeHistory] = useState<ChallengeDay[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [allCategories, setAllCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    getGrowthData(user.id).then((data) => {
      setProfile(data.profile)
      setChallengeHistory(data.challengeHistory)
      setCategoryStats(data.categoryStats)
      setAllCategories(data.allCategories)
      setLoading(false)
    })
  }, [user, getGrowthData])

  if (loading) return <LoadingSpinner message="Loading your journey" />
  if (!profile) return null

  // Suppress unused variable warning
  void ALL_CATEGORIES

  const streak = profile.streak_count || 0
  const points = profile.total_points || 0
  const completed = profile.challenges_completed || 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
        Growth
      </p>
      <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-10">
        Your Journey
      </h1>

      {/* Stat cards */}
      <div className="flex gap-4">
        <StatCard emoji="&#x1F525;" value={streak} label={streak === 1 ? 'day streak' : 'day streak'} />
        <StatCard emoji="&#x2B50;" value={points} label="total points" />
        <StatCard emoji="&#x1F3AF;" value={completed} label="chall. done" />
      </div>

      {/* Streak heatmap */}
      <Section label="Your streak">
        <HeatmapCalendar history={challengeHistory} />
      </Section>

      {/* Category breakdown */}
      <Section label="Where you've grown">
        <CategoryBars stats={categoryStats} />
      </Section>

      {/* Milestones */}
      <Section label="Milestones">
        <MilestonesSection profile={profile} allCategories={allCategories} />
      </Section>

      {/* Community */}
      <Section label="Your community">
        <div className="text-sm text-[var(--text-secondary)] space-y-3">
          <p>
            Your small actions ripple outward. Every challenge you complete contributes to a
            growing community of people choosing to be intentional about growth.
          </p>
          <p className="text-[var(--text-tertiary)] italic">
            This is not a ranking. This is a reminder that you are part of something bigger.
          </p>
        </div>
      </Section>
    </div>
  )
}
