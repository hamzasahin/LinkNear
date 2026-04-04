import { useEffect, useState, useCallback } from 'react'
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
const LOOKING_FOR_ICONS: Record<string, string> = {
  cofounder: '🚀',
  'study-buddy': '📚',
  mentor: '🎓',
  mentee: '🌱',
  collaborator: '🤝',
  networking: '🌐',
  friends: '😊',
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 skeleton rounded w-3/4" />
          <div className="h-3 skeleton rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 skeleton rounded w-1/3" />
      <div className="flex gap-2">
        <div className="h-6 skeleton rounded-full w-16" />
        <div className="h-6 skeleton rounded-full w-20" />
        <div className="h-6 skeleton rounded-full w-14" />
      </div>
      <div className="h-9 skeleton rounded-lg" />
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

  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent-primary)] hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer group relative"
      onClick={() => navigate(`/profile/${profile.id}`)}
    >
      {profile.match_score !== undefined && (
        <div className="absolute top-4 right-4">
          <MatchBadge score={profile.match_score} />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
          {profile.is_online && (
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[var(--success)] rounded-full border-2 border-[var(--bg-surface)]" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">{profile.full_name}</h3>
          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{profile.headline}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-[var(--text-tertiary)]">📍 {profile.distance_km} km away</span>
        {profile.looking_for && (
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded-full">
            {LOOKING_FOR_ICONS[profile.looking_for] || '🌐'} {profile.looking_for.replace('-', ' ')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.skills.slice(0, 3).map(skill => (
          <TagChip key={skill} label={skill} variant="skill" />
        ))}
        {profile.skills.length > 3 && (
          <span className="text-xs text-[var(--text-tertiary)] self-center">+{profile.skills.length - 3} more</span>
        )}
      </div>

      <div onClick={e => e.stopPropagation()}>
        {connectionStatus === 'accepted' ? (
          <span className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[rgba(16,185,129,0.15)] text-[var(--success)] text-sm font-semibold border border-[rgba(16,185,129,0.3)]">
            ✓ Connected
          </span>
        ) : connectionStatus === 'pending_sent' ? (
          <span className="w-full flex items-center justify-center py-2 rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] text-sm border border-[var(--border)]">
            Request Sent
          </span>
        ) : connectionStatus === 'pending_received' ? (
          <span className="w-full flex items-center justify-center py-2 rounded-lg bg-[rgba(255,179,71,0.15)] text-[var(--accent-tertiary)] text-sm border border-[rgba(255,179,71,0.3)]">
            Wants to Connect
          </span>
        ) : (
          <button
            onClick={() => onConnect(profile)}
            className="w-full py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const { profiles, loading, error, fetchNearbyProfiles } = useDiscover()
  const location = useLocation()
  const { getMyProfile } = useProfile()
  const { getConnections, sendConnection, getConnectionStatus } = useConnections()
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [radius, setRadius] = useState(10)
  const [sortBy, setSortBy] = useState<'distance' | 'match'>('distance')
  const [filterLooking, setFilterLooking] = useState('all')
  const [selectedProfile, setSelectedProfile] = useState<NearbyProfile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    getMyProfile().then(p => setMyProfile(p))
    getConnections()
  }, [])

  const doFetch = useCallback(() => {
    if (location.latitude && location.longitude) {
      fetchNearbyProfiles(location.latitude, location.longitude, radius, myProfile)
    }
  }, [location.latitude, location.longitude, radius, myProfile, fetchNearbyProfiles])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  const handleConnect = (profile: NearbyProfile) => {
    setSelectedProfile(profile)
    setModalOpen(true)
  }

  const handleSendConnection = async (message: string) => {
    if (!selectedProfile) return
    await sendConnection(selectedProfile.id, message)
    await getConnections()
  }

  const sorted = [...profiles]
    .filter(p => filterLooking === 'all' || p.looking_for === filterLooking)
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distance_km - b.distance_km
      return (b.match_score || 0) - (a.match_score || 0)
    })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">Discover</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          {location.locationName
            ? `Showing people near ${location.locationName}`
            : location.loading
            ? 'Getting your location...'
            : 'Enable location to find people nearby'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center mb-6 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">Radius:</span>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-primary)]"
          />
          <span className="text-sm font-semibold text-[var(--accent-primary)] w-12 text-right">{radius} km</span>
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'distance' | 'match')}
          className="bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent-primary)]"
        >
          <option value="distance">Nearest first</option>
          <option value="match">Best match first</option>
        </select>

        <select
          value={filterLooking}
          onChange={e => setFilterLooking(e.target.value)}
          className="bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent-primary)]"
        >
          <option value="all">All goals</option>
          <option value="cofounder">🚀 Cofounder</option>
          <option value="study-buddy">📚 Study Buddy</option>
          <option value="mentor">🎓 Mentor</option>
          <option value="mentee">🌱 Mentee</option>
          <option value="collaborator">🤝 Collaborator</option>
          <option value="networking">🌐 Networking</option>
          <option value="friends">😊 Friends</option>
        </select>

        <button
          onClick={doFetch}
          className="px-4 py-2 text-sm rounded-lg bg-[rgba(0,191,166,0.15)] text-[var(--accent-primary)] border border-[rgba(0,191,166,0.3)] hover:bg-[rgba(0,191,166,0.25)] transition-all font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 mb-6 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--danger)] text-sm">
          Error loading profiles: {error}
          <button onClick={doFetch} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Location required */}
      {!location.loading && !location.latitude && !error && (
        <EmptyState
          icon="📍"
          title="Location required"
          description="We need your location to find people nearby. Please allow location access in your browser."
          action={{ label: 'Try again', onClick: () => location.refreshLocation() }}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Profile cards */}
      {!loading && location.latitude && (
        <>
          {sorted.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No one nearby yet"
              description={`No profiles found within ${radius} km. Try expanding your radius!`}
              action={{ label: 'Expand to 50km', onClick: () => setRadius(50) }}
            />
          ) : (
            <>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">{sorted.length} people found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sorted.map(profile => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onConnect={handleConnect}
                    connectionStatus={getConnectionStatus(profile.id)}
                  />
                ))}
              </div>
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
