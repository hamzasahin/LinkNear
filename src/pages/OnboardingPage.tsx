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
  { value: 'cofounder', icon: '🚀', label: 'Cofounder', desc: 'Looking for a partner to build something' },
  { value: 'study-buddy', icon: '📚', label: 'Study Buddy', desc: 'Want to learn and grow together' },
  { value: 'mentor', icon: '🎓', label: 'Mentor', desc: 'Happy to guide others' },
  { value: 'mentee', icon: '🌱', label: 'Mentee', desc: 'Looking for guidance and advice' },
  { value: 'collaborator', icon: '🤝', label: 'Collaborator', desc: 'Want to work on projects together' },
  { value: 'networking', icon: '🌐', label: 'Networking', desc: 'Expanding my professional circle' },
  { value: 'friends', icon: '😊', label: 'Friends', desc: 'Just looking to meet cool people' },
]

const STEPS = ['Basics', 'Skills', 'Interests', 'Goals', 'Location']

export default function OnboardingPage() {
  const { user } = useAuth()
  const { getMyProfile, updateProfile, uploadAvatar } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [manualLocation, setManualLocationInput] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [manualName, setManualName] = useState('')

  const [form, setForm] = useState({
    full_name: user?.user_metadata?.full_name || '',
    headline: '',
    avatar_url: user?.user_metadata?.avatar_url || '',
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
        setForm(f => ({
          ...f,
          full_name: p.full_name || f.full_name,
          headline: p.headline || '',
          skills: p.skills || [],
          interests: p.interests || [],
          looking_for: p.looking_for || 'networking',
        }))
      }
    })
  }, [])

  useEffect(() => {
    if (location.latitude && location.longitude) {
      setForm(f => ({ ...f, latitude: location.latitude, longitude: location.longitude, location_name: location.locationName }))
    }
  }, [location.latitude, location.longitude, location.locationName])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const canNext = () => {
    if (step === 0) return form.full_name.trim().length > 0
    if (step === 1) return form.skills.length >= 3
    if (step === 2) return form.interests.length >= 2
    if (step === 3) return !!form.looking_for
    return true
  }

  const handleSubmit = async () => {
    setSaving(true)

    let avatarUrl = form.avatar_url
    if (avatarFile) {
      const url = await uploadAvatar(avatarFile)
      if (url) avatarUrl = url
    }

    if (manualLocation) {
      const lat = parseFloat(manualLat)
      const lng = parseFloat(manualLng)
      if (!isNaN(lat) && !isNaN(lng)) {
        setForm(f => ({ ...f, latitude: lat, longitude: lng, location_name: manualName }))
        await updateProfile({
          ...form,
          avatar_url: avatarUrl,
          latitude: lat,
          longitude: lng,
          location_name: manualName,
        })
      } else {
        await updateProfile({ ...form, avatar_url: avatarUrl })
      }
    } else {
      await updateProfile({ ...form, avatar_url: avatarUrl })
    }

    navigate('/discover', { replace: true })
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">Let's set up your profile</h2>
              <p className="text-[var(--text-secondary)]">Tell people a bit about yourself.</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar
                  src={avatarPreview || form.avatar_url}
                  name={form.full_name || 'User'}
                  size="xl"
                />
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-[var(--accent-primary)] rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity shadow-lg">
                  <svg className="w-4 h-4 text-[var(--bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Click the camera to change your photo</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Full Name *</label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Alex Chen"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Headline</label>
              <input
                type="text"
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="ML Engineer | Python | Open Source"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
              />
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">What are your skills?</h2>
              <p className="text-[var(--text-secondary)]">Add at least 3 skills — these power your match score.</p>
            </div>
            <TagInput
              tags={form.skills}
              onChange={skills => setForm(f => ({ ...f, skills }))}
              suggestions={SKILL_SUGGESTIONS}
              placeholder="Type a skill or pick from suggestions..."
              variant="skill"
            />
            <p className="text-sm text-[var(--text-tertiary)]">
              {form.skills.length < 3
                ? `Add ${3 - form.skills.length} more skill${3 - form.skills.length !== 1 ? 's' : ''} to continue`
                : `✓ ${form.skills.length} skills added`}
            </p>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">What are you into?</h2>
              <p className="text-[var(--text-secondary)]">Add at least 2 interests — helps find people who share your passions.</p>
            </div>
            <TagInput
              tags={form.interests}
              onChange={interests => setForm(f => ({ ...f, interests }))}
              suggestions={INTEREST_SUGGESTIONS}
              placeholder="Type an interest or pick from suggestions..."
              variant="interest"
            />
            <p className="text-sm text-[var(--text-tertiary)]">
              {form.interests.length < 2
                ? `Add ${2 - form.interests.length} more interest${2 - form.interests.length !== 1 ? 's' : ''} to continue`
                : `✓ ${form.interests.length} interests added`}
            </p>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">What are you looking for?</h2>
              <p className="text-[var(--text-secondary)]">This helps people understand why you want to connect.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LOOKING_FOR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, looking_for: opt.value }))}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    form.looking_for === opt.value
                      ? 'border-[var(--accent-primary)] bg-[rgba(0,191,166,0.1)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{opt.label}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">Where are you?</h2>
              <p className="text-[var(--text-secondary)]">Your approximate location helps us find people nearby.</p>
            </div>

            {location.loading && (
              <div className="flex items-center gap-3 p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border)]">
                <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)] text-sm">Detecting your location...</p>
              </div>
            )}

            {!location.loading && location.latitude && !manualLocation && (
              <div className="p-4 bg-[rgba(0,191,166,0.08)] border border-[rgba(0,191,166,0.3)] rounded-xl">
                <p className="text-[var(--accent-primary)] font-medium text-sm">📍 Location detected</p>
                <p className="text-[var(--text-primary)] mt-1">
                  {form.location_name || `${form.latitude?.toFixed(4)}, ${form.longitude?.toFixed(4)}`}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}
                </p>
              </div>
            )}

            {!location.loading && location.error && !manualLocation && (
              <div className="p-4 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-xl">
                <p className="text-[var(--danger)] font-medium text-sm">⚠️ Location access denied</p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">{location.error}</p>
              </div>
            )}

            <button
              onClick={() => setManualLocationInput(v => !v)}
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              {manualLocation ? 'Use detected location' : 'Enter location manually'}
            </button>

            {manualLocation && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="Location name (e.g. San Jose, CA)"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                    placeholder="Latitude (e.g. 37.33)"
                    step="any"
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
                  />
                  <input
                    type="number"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                    placeholder="Longitude (e.g. -121.89)"
                    step="any"
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] text-sm"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--text-tertiary)]">
              🔒 Your exact location is never shared. Only an approximate area is used for discovery.
            </p>
          </div>
        )

      default:
        return null
    }
  }

  if (saving) {
    return <LoadingSpinner fullScreen message="Setting up your profile..." />
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-display text-3xl font-bold text-[var(--accent-primary)]">LinkNear</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i === step
                    ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                    : i < step
                    ? 'bg-[rgba(0,191,166,0.3)] text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--border)]'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mb-8 uppercase tracking-widest">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>

        {/* Form */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8">
          {renderStep()}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-5 py-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-surface-hover)] transition-all text-sm"
              >
                ← Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="flex-1 py-3 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-all text-sm"
              >
                Start Discovering! 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
