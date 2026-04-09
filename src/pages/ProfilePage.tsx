import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link, useLocation as useRouterLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from '../hooks/useLocation'
import { useModeration } from '../hooks/useModeration'
import { useConnections } from '../hooks/useConnections'
import { shouldShowPhoto } from '../utils/photoPrivacy'
import type { ProfileWithDistance, ReportCategory } from '../types'
import Avatar from '../components/Avatar'
import TagChip from '../components/TagChip'
import ConnectionButton from '../components/ConnectionButton'
import LoadingSpinner from '../components/LoadingSpinner'
import BlockConfirmModal from '../components/BlockConfirmModal'
import ReportModal from '../components/ReportModal'
import { rpcWithRetry } from '../lib/rpcRetry'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
      {children}
    </p>
  )
}

/**
 * Coarse "last active" bucket so the UI never exposes minute-precision
 * presence (an anti-stalking measure). The server already rounds `last_seen`
 * to 5-minute buckets; we add extra coarsening on display.
 */
function formatLastSeen(dateStr: string, isOnline: boolean): string {
  if (isOnline) return 'Online'
  const diffMin = (Date.now() - new Date(dateStr).getTime()) / 60_000
  if (diffMin < 5) return 'Active now'
  if (diffMin < 60) return 'Active recently'
  if (diffMin < 24 * 60) return 'Active today'
  if (diffMin < 7 * 24 * 60) return 'Active this week'
  return 'Active a while ago'
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const navState = routerLocation.state as { distance_km?: number } | null
  const fallbackDistance = navState?.distance_km ?? null
  const { blockUser, reportUser } = useModeration()
  const { getConnections, getConnectionStatus } = useConnections()
  const [menuOpen, setMenuOpen] = useState(false)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getConnections()
  }, [getConnections])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const requestKey = id
    ? [id, location.latitude ?? 'none', location.longitude ?? 'none', fallbackDistance ?? 'none'].join(':')
    : null
  const [profileState, setProfileState] = useState<{
    requestKey: string | null
    profile: ProfileWithDistance | null
    error: string | null
  }>({
    requestKey: null,
    profile: null,
    error: null,
  })

  const isOwnProfile = user?.id === id

  useEffect(() => {
    if (!id || !requestKey) return

    let cancelled = false

    rpcWithRetry<ProfileWithDistance[]>(() =>
      supabase.rpc('get_profile_with_distance', {
        p_id: id,
        user_lat: location.latitude,
        user_lng: location.longitude,
      })
    )
      .then(rows => {
        if (cancelled) return
        const row = rows?.[0] ?? null
        setProfileState({
          requestKey,
          profile: row
            ? {
                ...row,
                distance_km: row.distance_km ?? fallbackDistance,
              }
            : null,
          error: null,
        })
      })
      .catch(e => {
        if (!cancelled) {
          setProfileState({
            requestKey,
            profile: null,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [fallbackDistance, id, location.latitude, location.longitude, requestKey])

  const loading = Boolean(requestKey && profileState.requestKey !== requestKey)
  const profile = profileState.requestKey === requestKey ? profileState.profile : null
  const error = profileState.requestKey === requestKey ? profileState.error : null

  const connectionStatus = id ? getConnectionStatus(id) : 'none'
  const photoRevealed = !id || !user?.id
    ? true
    : shouldShowPhoto(
        id,
        user.id,
        profile?.show_photo_publicly ?? false,
        connectionStatus as 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'
      )

  if (loading) return <LoadingSpinner fullScreen message="Loading profile" />
  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
          Not found
        </p>
        <h2 className="font-display text-3xl text-[var(--text-primary)] mb-6">
          This profile no longer exists.
        </h2>
        {error && <p className="text-[var(--text-tertiary)] text-sm mb-6">{error}</p>}
        <button
          onClick={() => navigate('/discover')}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          Back to Discover →
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← Back
        </button>

        {!isOwnProfile && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More actions"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] overflow-hidden z-40">
                <button
                  onClick={() => { setMenuOpen(false); setReportModalOpen(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Report
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setBlockModalOpen(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  Block
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header — editorial masthead */}
      <header className="flex items-start gap-6 mb-10">
        <div className="relative flex-shrink-0">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" revealed={photoRevealed} />
          {!photoRevealed && (
            <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mt-2 text-center max-w-[6rem]">
              Photos become visible after connecting.
            </p>
          )}
          <span
            className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-[var(--bg-primary)] ${
              profile.is_online ? 'bg-[var(--success)]' : 'bg-[var(--text-faint)]'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.05] mb-2">
            {profile.full_name}
          </h1>
          {profile.headline && (
            <p className="text-[var(--text-secondary)] text-base mb-4">{profile.headline}</p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {profile.location_name && <span>{profile.location_name}</span>}
            {profile.distance_km !== null && profile.distance_km !== undefined && (
              <span>{profile.distance_km.toFixed(1)} km away</span>
            )}
            <span>{formatLastSeen(profile.last_seen, profile.is_online)}</span>
            {profile.looking_for && (
              <span>Looking for {profile.looking_for.replace('-', ' ')}</span>
            )}
          </div>

          <div className="mt-6">
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
              >
                Edit profile →
              </Link>
            ) : (
              <ConnectionButton targetUserId={profile.id} targetProfileName={profile.full_name} />
            )}
          </div>
        </div>
      </header>

      {/* Bio */}
      {profile.bio && (
        <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
          <SectionLabel>About</SectionLabel>
          <p className="font-display text-lg text-[var(--text-primary)] leading-[1.45] max-w-prose whitespace-pre-wrap">
            {profile.bio}
          </p>
        </section>
      )}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
          <SectionLabel>Skills</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(s => <TagChip key={s} label={s} variant="skill" />)}
          </div>
        </section>
      )}

      {/* Interests */}
      {profile.interests.length > 0 && (
        <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
          <SectionLabel>Interests</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map(i => <TagChip key={i} label={i} variant="interest" />)}
          </div>
        </section>
      )}

      <BlockConfirmModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        targetName={profile.full_name}
        onConfirm={async reason => {
          const result = await blockUser(profile.id, reason)
          if (!result.error) navigate('/discover')
          return result
        }}
      />

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetName={profile.full_name}
        onSubmit={async (category: ReportCategory, details: string) =>
          reportUser(profile.id, category, details)
        }
      />
    </div>
  )
}
