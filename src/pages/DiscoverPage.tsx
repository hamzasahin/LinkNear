import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiscover } from '../hooks/useDiscover'
import { useLocation } from '../hooks/useLocation'
import { useProfile } from '../hooks/useProfile'
import { useConnections } from '../hooks/useConnections'
import type { NearbyProfile, Profile } from '../types'
import Avatar from '../components/Avatar'
import TagChip from '../components/TagChip'
import MatchBadge from '../components/MatchBadge'
import ConnectionModal from '../components/ConnectionModal'
import EmptyState from '../components/EmptyState'

const LOOKING_FOR_LABELS: Record<string, string> = {
  cofounder: 'Cofounder',
  'study-buddy': 'Study buddy',
  mentor: 'Mentor',
  mentee: 'Mentee',
  collaborator: 'Collaborator',
  networking: 'Networking',
  friends: 'Friends',
}

function SkeletonCard() {
  return (
    <div className="border-t border-[var(--border)] py-6 space-y-3">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 skeleton rounded w-3/4" />
          <div className="h-3 skeleton rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 ml-[4.5rem]">
        <div className="h-6 skeleton rounded w-16" />
        <div className="h-6 skeleton rounded w-20" />
        <div className="h-6 skeleton rounded w-14" />
      </div>
    </div>
  )
}

interface ProfileCardProps {
  profile: NearbyProfile
  onConnect: (profile: NearbyProfile) => void
  connectionStatus: string
}

function ProfileCard({ profile, onConnect, connectionStatus }: ProfileCardProps) {
  const navigate = useNavigate()

  const goToProfile = () =>
    navigate(`/profile/${profile.id}`, { state: { distance_km: profile.distance_km } })

  return (
    <article className="border-t border-[var(--border)] py-7 group">
      <div className="flex items-start gap-4 cursor-pointer" onClick={goToProfile}>
        <div className="relative flex-shrink-0">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
          {profile.is_online && (
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[var(--success)] rounded-full border-2 border-[var(--bg-primary)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="font-display text-xl text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent-primary)] transition-colors truncate">
              {profile.full_name}
            </h3>
            {profile.match_score !== undefined && (
              <div className="flex-shrink-0">
                <MatchBadge score={profile.match_score} />
              </div>
            )}
          </div>
          {profile.headline && (
            <p className="text-sm text-[var(--text-tertiary)] truncate mb-2">{profile.headline}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-3">
            <span className="tabular-nums">{profile.distance_km} km</span>
            {profile.looking_for && (
              <span>{LOOKING_FOR_LABELS[profile.looking_for] || profile.looking_for}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {profile.skills.slice(0, 3).map(skill => (
              <TagChip key={skill} label={skill} variant="skill" />
            ))}
            {profile.skills.length > 3 && (
              <span className="font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] self-center">
                +{profile.skills.length - 3} more
              </span>
            )}
          </div>

          <div onClick={e => e.stopPropagation()}>
            {connectionStatus === 'accepted' ? (
              <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                · Connected
              </span>
            ) : connectionStatus === 'pending_sent' ? (
              <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                · Request sent
              </span>
            ) : connectionStatus === 'pending_received' ? (
              <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--accent-primary)]">
                · Wants to connect
              </span>
            ) : (
              <button
                onClick={() => onConnect(profile)}
                className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
              >
                Connect →
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

const selectClass = "bg-[var(--bg-primary)] border border-[var(--border-strong)] text-[var(--text-primary)] text-sm rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"

export default function DiscoverPage() {
  const { profiles, loading, loadingMore, error, hasMore, fetchNearbyProfiles, loadMore } = useDiscover()
  const location = useLocation()
  const { getMyProfile } = useProfile()
  const { getConnections, sendConnection, getConnectionStatus } = useConnections()
  const navigate = useNavigate()
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [radius, setRadius] = useState(10)
  const [sortBy, setSortBy] = useState<'distance' | 'match'>('distance')
  const [filterLooking, setFilterLooking] = useState<string>('all')
  const [selectedProfile, setSelectedProfile] = useState<NearbyProfile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMyProfile().then(p => setMyProfile(p))
    getConnections()
  }, [getConnections, getMyProfile])

  const doFetch = useCallback(() => {
    if (location.latitude && location.longitude) {
      fetchNearbyProfiles({
        lat: location.latitude,
        lng: location.longitude,
        radiusKm: radius,
        lookingFor: filterLooking === 'all' ? null : filterLooking,
        myProfile,
      })
    }
  }, [location.latitude, location.longitude, radius, filterLooking, myProfile, fetchNearbyProfiles])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadMore])

  const handleConnect = (profile: NearbyProfile) => {
    setSelectedProfile(profile)
    setModalOpen(true)
  }

  const handleSendConnection = async (message: string) => {
    if (!selectedProfile) return
    const { error: sendError } = await sendConnection(selectedProfile.id, message)
    if (!sendError) await getConnections()
  }

  const sorted = [...profiles].sort((a, b) => {
    if (sortBy === 'distance') return a.distance_km - b.distance_km
    return (b.match_score || 0) - (a.match_score || 0)
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Masthead */}
      <header className="mb-10">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
          Proximity
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-3">
          Discover
        </h1>
        <p className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {location.locationName
            ? `Near ${location.locationName}`
            : location.loading
            ? 'Locating…'
            : 'Enable location to begin'}
        </p>
      </header>

      {/* Discovery disabled notice */}
      {myProfile && myProfile.discovery_enabled === false && (
        <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4 mb-8 text-sm text-[var(--text-secondary)] flex items-center gap-3">
          <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Invisible
          </span>
          You are hidden from discovery. Others cannot see you.
          <button
            onClick={() => navigate('/settings')}
            className="ml-auto text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
          >
            Turn back on →
          </button>
        </div>
      )}

      {/* Controls — editorial strip, no card */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-2 pb-6 border-b border-[var(--border-strong)]">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] whitespace-nowrap">
            Radius
          </span>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-primary)]"
          />
          <span className="font-pixel text-sm text-[var(--text-primary)] tabular-nums w-14 text-right">
            {radius} km
          </span>
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'distance' | 'match')}
          className={selectClass}
        >
          <option value="distance">Nearest first</option>
          <option value="match">Best match first</option>
        </select>

        <select
          value={filterLooking}
          onChange={e => setFilterLooking(e.target.value)}
          className={selectClass}
        >
          <option value="all">All goals</option>
          <option value="cofounder">Cofounder</option>
          <option value="study-buddy">Study buddy</option>
          <option value="mentor">Mentor</option>
          <option value="mentee">Mentee</option>
          <option value="collaborator">Collaborator</option>
          <option value="networking">Networking</option>
          <option value="friends">Friends</option>
        </select>

        <button
          onClick={doFetch}
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          Refresh →
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-[var(--danger)] rounded-[var(--radius-md)] p-4 my-8 text-sm text-[var(--danger)]">
          <span className="font-pixel text-[10px] uppercase tracking-[0.1em] mr-2">Err</span>
          {error}
          <button
            onClick={doFetch}
            className="ml-3 underline underline-offset-4 hover:decoration-[2px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Location required */}
      {!location.loading && !location.latitude && !error && (
        <EmptyState
          icon="○"
          title="Location required."
          description="LinkNear needs your location to find people nearby. Please allow location access in your browser."
          action={{ label: 'Try again', onClick: () => location.refreshLocation() }}
        />
      )}

      {/* Loading state (initial) */}
      {loading && profiles.length === 0 && (
        <div>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Profile list */}
      {!loading && location.latitude && (
        <>
          {sorted.length === 0 ? (
            <EmptyState
              icon="∅"
              title="No one nearby yet."
              description={`No profiles within ${radius} km. Expand your radius.`}
              action={{ label: 'Expand to 50 km', onClick: () => setRadius(50) }}
            />
          ) : (
            <>
              <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] tabular-nums my-6">
                {sorted.length.toString().padStart(3, '0')} {sorted.length === 1 ? 'person' : 'people'} found
                {hasMore ? ' · scroll for more' : ''}
              </p>
              <div>
                {sorted.map(profile => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onConnect={handleConnect}
                    connectionStatus={getConnectionStatus(profile.id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="py-10 text-center font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  {loadingMore ? 'Loading more…' : ''}
                </div>
              )}
            </>
          )}
        </>
      )}

      <ConnectionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedProfile(null) }}
        onSend={handleSendConnection}
        recipientName={selectedProfile?.full_name || ''}
      />
    </div>
  )
}
