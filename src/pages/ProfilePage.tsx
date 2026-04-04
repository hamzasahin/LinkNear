import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from '../hooks/useLocation'
import type { Profile } from '../types'
import Avatar from '../components/Avatar'
import TagChip from '../components/TagChip'
import ConnectionButton from '../components/ConnectionButton'
import LoadingSpinner from '../components/LoadingSpinner'

const LOOKING_FOR_ICONS: Record<string, string> = {
  cofounder: '🚀',
  'study-buddy': '📚',
  mentor: '🎓',
  mentee: '🌱',
  collaborator: '🤝',
  networking: '🌐',
  friends: '😊',
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { getProfile } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const isOwnProfile = user?.id === id

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProfile(id).then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingSpinner fullScreen message="Loading profile..." />
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-6xl mb-4">😕</p>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Profile not found</h2>
        <button onClick={() => navigate('/discover')} className="text-[var(--accent-primary)] hover:underline text-sm">
          ← Back to Discover
        </button>
      </div>
    )
  }

  const distance = location.latitude && profile.latitude
    ? getDistance(location.latitude, location.longitude!, profile.latitude, profile.longitude!)
    : null

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6 text-sm"
      >
        ← Back
      </button>

      {/* Header card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
            <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-surface)] ${profile.is_online ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-[var(--text-primary)] mb-1">{profile.full_name}</h1>
            {profile.headline && (
              <p className="text-[var(--text-secondary)] text-sm mb-2">{profile.headline}</p>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-[var(--text-tertiary)] mb-3">
              {profile.location_name && (
                <span>📍 {profile.location_name}</span>
              )}
              {distance !== null && (
                <span>↔ {distance.toFixed(1)} km from you</span>
              )}
              <span>{profile.is_online ? '🟢 Online' : `⚫ Last seen ${timeSince(profile.last_seen)}`}</span>
            </div>

            {profile.looking_for && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-full border border-[var(--border)]">
                {LOOKING_FOR_ICONS[profile.looking_for]} Looking for {profile.looking_for.replace('-', ' ')}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-[var(--border)] flex gap-3">
          {isOwnProfile ? (
            <Link
              to="/settings"
              className="px-5 py-2.5 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-all"
            >
              Edit Profile
            </Link>
          ) : (
            <ConnectionButton targetUserId={profile.id} targetProfile={profile} />
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">About</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(s => <TagChip key={s} label={s} variant="skill" />)}
          </div>
        </div>
      )}

      {/* Interests */}
      {profile.interests.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map(i => <TagChip key={i} label={i} variant="interest" />)}
          </div>
        </div>
      )}
    </div>
  )
}
