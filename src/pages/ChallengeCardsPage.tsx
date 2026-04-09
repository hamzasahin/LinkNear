import { useState, useEffect, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'

interface Challenge {
  id: string
  title: string
  description: string
  category: string
  source_text: string | null
  source: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  kindness: '#D4654A',
  gratitude: '#4a7c59',
  courage: '#4a9fff',
  wisdom: '#9b6b9e',
  connection: '#D4654A',
  reflection: '#706a64',
  generosity: '#c49a3c',
  default: '#D4654A',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.default
}

export default function ChallengeCardsPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchChallenges() {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('challenges')
        .select('id, title, description, category, source_text, source')
        .order('created_at', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }
      setChallenges(data ?? [])
      setLoading(false)
    }
    fetchChallenges()
  }, [])

  const current = challenges[index] ?? null

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : challenges.length - 1))
  }, [challenges.length])

  const next = useCallback(() => {
    setIndex((i) => (i < challenges.length - 1 ? i + 1 : 0))
  }, [challenges.length])

  const downloadCard = useCallback(async () => {
    if (!cardRef.current || !current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
      })
      const link = document.createElement('a')
      link.download = `linknear-challenge-${index + 1}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to download card:', err)
    } finally {
      setDownloading(false)
    }
  }, [current, index])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F5F0EB' }}
      >
        <p className="font-pixel text-sm" style={{ color: '#706a64' }}>
          Loading challenges...
        </p>
      </div>
    )
  }

  if (error || challenges.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
        style={{ backgroundColor: '#F5F0EB' }}
      >
        <p className="font-pixel text-sm" style={{ color: '#706a64' }}>
          {error
            ? `Could not load challenges: ${error}`
            : 'No challenges found. Add challenges to the database to see cards here.'}
        </p>
      </div>
    )
  }

  const accentColor = getCategoryColor(current.category)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ backgroundColor: '#F5F0EB' }}
    >
      {/* Card counter */}
      <p className="font-pixel text-xs uppercase tracking-[0.15em]" style={{ color: '#706a64' }}>
        {index + 1} of {challenges.length}
      </p>

      {/* Card — 1080x1080 aspect ratio */}
      <div
        ref={cardRef}
        className="flex flex-col justify-between"
        style={{
          width: '540px',
          height: '540px',
          backgroundColor: '#F5F0EB',
          padding: '48px',
          overflow: 'hidden',
          border: `2px solid ${accentColor}`,
          borderRadius: '8px',
        }}
      >
        {/* Top: label */}
        <div>
          <p
            className="font-pixel text-[10px] uppercase tracking-[0.2em] mb-8"
            style={{ color: accentColor }}
          >
            LinkNear &middot; Daily Challenge
          </p>

          {/* Category */}
          <span
            className="font-pixel inline-block text-[9px] uppercase tracking-[0.15em] px-2 py-1 rounded mb-6"
            style={{
              color: accentColor,
              backgroundColor: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {current.category}
          </span>

          {/* Title in quotes */}
          <h2
            className="font-display text-3xl leading-tight mb-5"
            style={{ color: '#3d3733' }}
          >
            &ldquo;{current.title}&rdquo;
          </h2>

          {/* Description */}
          <p
            className="text-sm leading-relaxed"
            style={{ color: '#494440', fontFamily: 'var(--font-sans)' }}
          >
            {current.description}
          </p>
        </div>

        {/* Bottom: source quote + branding */}
        <div>
          {/* Dashed divider */}
          <div
            className="mb-5"
            style={{
              borderTop: '1px dashed #c2beba',
            }}
          />

          {current.source_text && (
            <p
              className="text-sm italic leading-relaxed mb-1"
              style={{ color: '#706a64', fontFamily: 'var(--font-serif)' }}
            >
              &ldquo;{current.source_text}&rdquo;
            </p>
          )}
          {current.source && (
            <p
              className="font-pixel text-[10px] tracking-wide mb-5"
              style={{ color: '#706a64' }}
            >
              &mdash; {current.source}
            </p>
          )}

          <p
            className="font-pixel text-[10px] tracking-wide"
            style={{ color: accentColor }}
          >
            linknear.vercel.app
          </p>
        </div>
      </div>

      {/* Navigation + Download */}
      <div className="flex items-center gap-4">
        <button
          onClick={prev}
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg cursor-pointer transition-opacity hover:opacity-70"
          style={{ backgroundColor: '#FFFFFF', color: '#3d3733', border: '1px solid #eae3dd' }}
          aria-label="Previous challenge"
        >
          &larr;
        </button>

        <button
          onClick={downloadCard}
          disabled={downloading}
          className="px-6 py-2.5 rounded-lg text-white text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#D4654A' }}
        >
          {downloading ? 'Saving...' : 'Download as image'}
        </button>

        <button
          onClick={next}
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg cursor-pointer transition-opacity hover:opacity-70"
          style={{ backgroundColor: '#FFFFFF', color: '#3d3733', border: '1px solid #eae3dd' }}
          aria-label="Next challenge"
        >
          &rarr;
        </button>
      </div>
    </div>
  )
}
