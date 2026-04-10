import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { track } from '../lib/analytics'
import { useProfile } from '../hooks/useProfile'
import { useLocation } from '../hooks/useLocation'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'

const SKILL_SUGGESTIONS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'AI/ML',
  'Data Science', 'DevOps', 'Cloud', 'Mobile', 'UI/UX Design', 'Figma',
  'Product', 'Marketing', 'Sales', 'Writing', 'Research', 'Rust', 'Go',
]

const INTEREST_SUGGESTIONS = [
  'Open Source', 'Startups', 'AI Ethics', 'Climate Tech', 'Web3', 'Robotics',
  'Hiking', 'Gaming', 'Music', 'Photography', 'Cooking', 'Fitness',
  'Reading', 'Travel', 'Film', 'Public Speaking',
]

const LOOKING_FOR_OPTIONS = [
  { value: 'networking', label: 'Networking' },
  { value: 'cofounder', label: 'Cofounder' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'study-buddy', label: 'Study buddy' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'mentee', label: 'Mentee' },
  { value: 'friends', label: 'Friends' },
]

async function forwardGeocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    return null
  } catch {
    return null
  }
}

interface ChipPickerProps {
  selected: string[]
  suggestions: string[]
  onChange: (next: string[]) => void
  placeholder: string
}

function ChipPicker({ selected, suggestions, onChange, placeholder }: ChipPickerProps) {
  const [input, setInput] = useState('')

  const toggle = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (selected.includes(trimmed)) {
      onChange(selected.filter(s => s !== trimmed))
    } else {
      onChange([...selected, trimmed])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) {
        toggle(input)
        setInput('')
      }
    }
  }

  const chipClass = (isSelected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1 border font-pixel text-[11px] uppercase tracking-[0.06em] transition-colors ${
      isSelected
        ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:border-[var(--text-primary)]'
    }`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map(s => {
          const isSelected = selected.includes(s)
          return (
            <button key={s} type="button" onClick={() => toggle(s)} className={chipClass(isSelected)}>
              <span className="leading-none text-[var(--text-tertiary)]">{isSelected ? '×' : '+'}</span>
              {s}
            </button>
          )
        })}
        {selected
          .filter(s => !suggestions.includes(s))
          .map(s => (
            <button key={s} type="button" onClick={() => toggle(s)} className={chipClass(true)}>
              <span className="leading-none">×</span>
              {s}
            </button>
          ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) {
            toggle(input)
            setInput('')
          }
        }}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
      />
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border-strong)] pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-5">
        {label}
      </p>
      {children}
    </section>
  )
}

export default function OnboardingPage() {
  const { user, reloadProfile } = useAuth()
  const { getMyProfile, updateProfile, uploadAvatar } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [manualCity, setManualCity] = useState('')
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const hydratedRef = useRef(false)

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
  const [dob, setDob] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Age gate: parse DOB as a local date and require >= 13 years.
  const ageOk = (() => {
    if (!dob) return false
    const d = new Date(dob)
    if (Number.isNaN(d.getTime())) return false
    const today = new Date()
    const thirteenYearsAgo = new Date(
      today.getFullYear() - 13,
      today.getMonth(),
      today.getDate()
    )
    return d <= thirteenYearsAgo
  })()

  useEffect(() => {
    getMyProfile().then(p => {
      if (p && !hydratedRef.current) {
        hydratedRef.current = true
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (location.latitude && location.longitude) {
      setForm(f => ({
        ...f,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: location.locationName,
      }))
    }
  }, [location.latitude, location.longitude, location.locationName])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleManualCityBlur = async () => {
    const name = manualCity.trim()
    if (!name) {
      setManualCoords(null)
      return
    }
    setGeocoding(true)
    const coords = await forwardGeocode(name)
    setGeocoding(false)
    setManualCoords(coords)
  }

  const headlinePlaceholder = useMemo(() => {
    if (form.skills.length > 0) {
      return `${form.skills.slice(0, 2).join(' · ')} — open to connecting`
    }
    return 'ML Engineer · Open Source · Building side projects'
  }, [form.skills])

  const hasLocation = !!(form.latitude && form.longitude) || !!manualCoords
  const canSubmit =
    form.full_name.trim().length > 0 &&
    form.skills.length >= 1 &&
    hasLocation &&
    ageOk &&
    acceptedTerms

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)

    let avatarUrl = form.avatar_url
    if (avatarFile) {
      const { url, error: uploadError } = await uploadAvatar(avatarFile)
      if (uploadError) {
        setSaving(false)
        window.alert(uploadError)
        return
      }
      if (url) avatarUrl = url
    }

    const usingManual = manualCity.trim().length > 0 && manualCoords !== null
    const payload = {
      ...form,
      avatar_url: avatarUrl,
      latitude: usingManual ? manualCoords!.lat : form.latitude,
      longitude: usingManual ? manualCoords!.lng : form.longitude,
      location_name: usingManual ? manualCity.trim() : form.location_name,
      date_of_birth: dob,
      terms_accepted_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
    }

    const { error: updateError } = await updateProfile(payload)
    if (updateError) {
      setSaving(false)
      window.alert(updateError)
      return
    }
    // Refresh the profile in AuthContext so ProtectedRoute sees updated skills
    // and doesn't redirect back to /onboarding.
    await reloadProfile()
    track('onboarding_completed')
    navigate('/discover', { replace: true })
  }

  if (saving) {
    return <LoadingSpinner fullScreen message="Setting up your profile" />
  }

  const detectedLocationReady = !location.loading && !!location.latitude && !manualCity.trim()
  const locationFailed = !location.loading && !!location.error && !manualCity.trim()

  const inputClass = "w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top rule with wordmark */}
      <div className="border-b border-[var(--border-strong)] px-8 py-5">
        <span className="font-display text-xl text-[var(--text-primary)]">LinkNear</span>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
          Setup
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.05] mb-3">
          Let us introduce you to the people nearby.
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm mb-12">
          A sketch of who you are — about thirty seconds.
        </p>

        <Section label="Identity">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              <Avatar src={avatarPreview || form.avatar_url} name={form.full_name || 'User'} size="lg" />
              <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-full flex items-center justify-center cursor-pointer hover:border-[var(--accent-primary)] transition-colors">
                <svg className="w-3 h-3 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="flex-1 min-w-0 space-y-4">
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Your name"
                className="w-full bg-transparent border-b border-[var(--border-strong)] px-0 py-2 font-display text-2xl text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
              <input
                type="text"
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder={headlinePlaceholder}
                className="w-full bg-transparent border-b border-[var(--border-strong)] px-0 py-1.5 text-[var(--text-secondary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>
          </div>
        </Section>

        <Section label={`Skills · required ${form.skills.length > 0 ? `· ${form.skills.length.toString().padStart(2, '0')} selected` : ''}`}>
          <ChipPicker
            selected={form.skills}
            suggestions={SKILL_SUGGESTIONS}
            onChange={skills => setForm(f => ({ ...f, skills }))}
            placeholder="Or type a custom skill and press Enter"
          />
        </Section>

        <Section label="Looking for">
          <div className="flex flex-wrap gap-1.5">
            {LOOKING_FOR_OPTIONS.map(opt => {
              const active = form.looking_for === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, looking_for: opt.value }))}
                  className={`inline-flex items-center rounded-[var(--radius-md)] px-2.5 py-1 border font-pixel text-[11px] uppercase tracking-[0.06em] transition-colors ${
                    active
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:border-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        <Section label={`Interests · optional ${form.interests.length > 0 ? `· ${form.interests.length.toString().padStart(2, '0')} selected` : ''}`}>
          <ChipPicker
            selected={form.interests}
            suggestions={INTEREST_SUGGESTIONS}
            onChange={interests => setForm(f => ({ ...f, interests }))}
            placeholder="Or type a custom interest and press Enter"
          />
        </Section>

        <Section label="Location">
          {location.loading && (
            <p className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Detecting in background…
            </p>
          )}

          {detectedLocationReady && (
            <div className="flex items-start justify-between gap-4 border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4">
              <div className="min-w-0">
                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">
                  Detected
                </p>
                <p className="text-sm text-[var(--text-primary)] truncate">
                  {form.location_name || `${form.latitude?.toFixed(3)}, ${form.longitude?.toFixed(3)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualCity(form.location_name || '')}
                className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] whitespace-nowrap transition-all"
              >
                Change
              </button>
            </div>
          )}

          {locationFailed && (
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              We could not detect your location automatically — enter a city below.
            </p>
          )}

          {(manualCity.trim().length > 0 || locationFailed) && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={manualCity}
                onChange={e => setManualCity(e.target.value)}
                onBlur={handleManualCityBlur}
                placeholder="City, Country (e.g. San Jose, USA)"
                className={inputClass}
              />
              {geocoding && (
                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Looking up…
                </p>
              )}
              {!geocoding && manualCity.trim().length > 0 && manualCoords && (
                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--accent-primary)]">
                  · Found
                </p>
              )}
              {!geocoding && manualCity.trim().length > 0 && !manualCoords && (
                <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Not found — try a more specific name
                </p>
              )}
            </div>
          )}

          <p className="font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] mt-4">
            · Your exact location is never shared
          </p>
        </Section>

        <Section label="Age &amp; Terms">
          <div>
            <label className="block font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
              Date of birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            {dob && !ageOk && (
              <p className="text-xs text-[var(--danger)] mt-2">
                You must be at least 13 years old to use LinkNear.
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
            />
            <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] underline underline-offset-4"
              >
                Terms of Service
              </a>{' '}
              and have read the{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] underline underline-offset-4"
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </Section>

        <div className="flex items-center justify-end mt-12 pt-8 border-t border-[var(--border-strong)]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="text-base text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {canSubmit
              ? 'Start discovering →'
              : !form.full_name.trim()
              ? 'Add your name to continue'
              : form.skills.length < 1
              ? 'Add at least one skill'
              : !hasLocation
              ? 'Add your location'
              : !ageOk
              ? 'Enter a valid date of birth'
              : !acceptedTerms
              ? 'Accept the terms to continue'
              : 'Start discovering →'}
          </button>
        </div>
      </div>
    </div>
  )
}
