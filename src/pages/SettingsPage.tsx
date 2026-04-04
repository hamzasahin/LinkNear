import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useLocation } from '../hooks/useLocation'
import TagInput from '../components/TagInput'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'

const SKILL_SUGGESTIONS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Vue', 'Angular', 'Java', 'C++', 'Rust', 'Go',
  'AI/ML', 'Data Science', 'DevOps', 'Cloud', 'Kubernetes', 'Docker', 'Firmware', 'Embedded Systems',
  'Hardware', 'Mobile (iOS)', 'Mobile (Android)', 'Flutter', 'UI/UX Design', 'Figma', 'Product Management',
  'Project Management', 'Marketing', 'Sales', 'Finance', 'Writing', 'Research',
]

const INTEREST_SUGGESTIONS = [
  'Open Source', 'Startups', 'AI Ethics', 'Climate Tech', 'Web3', 'Blockchain', 'Robotics',
  'IoT', 'Space Tech', 'Biotech', 'Hiking', 'Gaming', 'Music', 'Photography', 'Cooking',
  'Fitness', 'Reading', 'Travel', 'Art', 'Film', 'Podcasts', 'Public Speaking', 'Volunteering',
  'Animal Welfare', 'Social Impact', 'Education', 'Mental Health',
]

const LOOKING_FOR_OPTIONS = [
  { value: 'cofounder', label: '🚀 Cofounder' },
  { value: 'study-buddy', label: '📚 Study Buddy' },
  { value: 'mentor', label: '🎓 Mentor' },
  { value: 'mentee', label: '🌱 Mentee' },
  { value: 'collaborator', label: '🤝 Collaborator' },
  { value: 'networking', label: '🌐 Networking' },
  { value: 'friends', label: '😊 Friends' },
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { getMyProfile, updateProfile, uploadAvatar } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    headline: '',
    bio: '',
    avatar_url: '',
    skills: [] as string[],
    interests: [] as string[],
    looking_for: 'networking',
    latitude: null as number | null,
    longitude: null as number | null,
    location_name: '',
  })

  useEffect(() => {
    getMyProfile().then(p => {
      if (p) {
        setForm({
          full_name: p.full_name || '',
          headline: p.headline || '',
          bio: p.bio || '',
          avatar_url: p.avatar_url || '',
          skills: p.skills || [],
          interests: p.interests || [],
          looking_for: p.looking_for || 'networking',
          latitude: p.latitude,
          longitude: p.longitude,
          location_name: p.location_name || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    setToast(null)

    let avatarUrl = form.avatar_url
    if (avatarFile) {
      const url = await uploadAvatar(avatarFile)
      if (url) avatarUrl = url
    }

    const { error } = await updateProfile({ ...form, avatar_url: avatarUrl })

    if (error) {
      setToast({ type: 'error', message: error })
    } else {
      setToast({ type: 'success', message: 'Profile saved!' })
      setTimeout(() => setToast(null), 3000)
    }
    setSaving(false)
  }

  const handleUseCurrentLocation = () => {
    if (location.latitude && location.longitude) {
      setForm(f => ({
        ...f,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: location.locationName,
      }))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading) return <LoadingSpinner message="Loading settings..." />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in-up ${
          toast.type === 'success'
            ? 'bg-[rgba(16,185,129,0.9)] text-white'
            : 'bg-[rgba(239,68,68,0.9)] text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <h1 className="font-display text-3xl text-[var(--text-primary)] mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar src={avatarPreview || form.avatar_url} name={form.full_name || 'User'} size="xl" />
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity shadow-lg">
                <svg className="w-4 h-4 text-[var(--bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">{form.full_name || 'Your name'}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">Basic Info</h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Headline</label>
            <input
              type="text"
              value={form.headline}
              onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
              placeholder="ML Engineer | Python | Open Source"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell people about yourself..."
              rows={4}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Looking For</label>
            <select
              value={form.looking_for}
              onChange={e => setForm(f => ({ ...f, looking_for: e.target.value }))}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
            >
              {LOOKING_FOR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">Skills</h2>
          <TagInput
            tags={form.skills}
            onChange={skills => setForm(f => ({ ...f, skills }))}
            suggestions={SKILL_SUGGESTIONS}
            placeholder="Type a skill or pick from suggestions..."
            variant="skill"
          />
        </div>

        {/* Interests */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">Interests</h2>
          <TagInput
            tags={form.interests}
            onChange={interests => setForm(f => ({ ...f, interests }))}
            suggestions={INTEREST_SUGGESTIONS}
            placeholder="Type an interest or pick from suggestions..."
            variant="interest"
          />
        </div>

        {/* Location */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">Location</h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Location Name</label>
            <input
              type="text"
              value={form.location_name}
              onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
              placeholder="San Jose, CA"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="37.3382"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="-121.8863"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all"
              />
            </div>
          </div>

          {location.latitude && (
            <button
              onClick={handleUseCurrentLocation}
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              📍 Use my current location ({location.locationName || `${location.latitude?.toFixed(3)}, ${location.longitude?.toFixed(3)}`})
            </button>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-xl bg-[var(--accent-primary)] text-[var(--bg-primary)] font-bold text-base hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {/* Sign out */}
        <div className="border-t border-[var(--border)] pt-6">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-xl border border-[var(--danger)] text-[var(--danger)] font-semibold hover:bg-[rgba(239,68,68,0.1)] transition-all text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
