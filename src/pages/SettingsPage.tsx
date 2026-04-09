import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useQuiz } from '../hooks/useQuiz'
import { useLocation } from '../hooks/useLocation'
import TagInput from '../components/TagInput'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import DeleteAccountModal from '../components/DeleteAccountModal'
import { validateProfileUpdate } from '../lib/validation'
import { useToast } from '../contexts/ToastContext'
import type { CharacterQuiz } from '../types'

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
  { value: 'cofounder', label: 'Cofounder' },
  { value: 'study-buddy', label: 'Study buddy' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'mentee', label: 'Mentee' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'networking', label: 'Networking' },
  { value: 'friends', label: 'Friends' },
]

// Editorial section wrapper — hairline top rule, small-caps pixel label
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border-strong)] pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-5">
        {label}
      </p>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
      {children}
    </label>
  )
}

const inputClass = "w-full bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { getMyProfile, updateProfile, uploadAvatar, deleteAccount } = useProfile()
  const { getQuiz } = useQuiz()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [quiz, setQuiz] = useState<CharacterQuiz | null>(null)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

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
    discovery_enabled: true,
    show_photo_publicly: false,
    email_digest: true,
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
          discovery_enabled: p.discovery_enabled ?? true,
          show_photo_publicly: p.show_photo_publicly ?? false,
          email_digest: p.email_digest ?? true,
        })
      }
      setLoading(false)
    })
    if (user) {
      getQuiz(user.id).then(q => setQuiz(q))
    }
  }, [getMyProfile, getQuiz, user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    // Client-side validation first — matches server CHECK constraints so
    // errors surface inline instead of as raw DB messages.
    const validation = validateProfileUpdate({
      full_name: form.full_name,
      headline: form.headline,
      bio: form.bio,
      skills: form.skills,
      interests: form.interests,
      looking_for: form.looking_for,
      latitude: form.latitude,
      longitude: form.longitude,
      location_name: form.location_name,
      discovery_enabled: form.discovery_enabled,
    })
    if (!validation.ok) {
      const firstError = Object.values(validation.errors)[0]
      showToast(firstError, 'error')
      return
    }

    setSaving(true)

    let avatarUrl = form.avatar_url
    if (avatarFile) {
      const { url, error: uploadError } = await uploadAvatar(avatarFile)
      if (uploadError) {
        setSaving(false)
        showToast(uploadError, 'error')
        return
      }
      if (url) avatarUrl = url
    }

    const { error } = await updateProfile({ ...form, avatar_url: avatarUrl })

    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Saved.', 'success')
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

  if (loading) return <LoadingSpinner message="Loading settings" />

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-2">
        Account
      </p>
      <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.1] mb-12">
        Settings
      </h1>

      <Section label="Photo">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar src={avatarPreview || form.avatar_url} name={form.full_name || 'User'} size="xl" />
            <label className="absolute bottom-0 right-0 w-7 h-7 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-full flex items-center justify-center cursor-pointer hover:border-[var(--accent-primary)] transition-colors">
              <svg className="w-3.5 h-3.5 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <p className="font-display text-xl text-[var(--text-primary)]">{form.full_name || 'Your name'}</p>
            <p className="font-pixel text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] mt-1">
              {user?.email}
            </p>
          </div>
        </div>
      </Section>

      <Section label="Identity">
        <div>
          <Label>Full name</Label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <Label>Headline</Label>
          <input
            type="text"
            value={form.headline}
            onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
            placeholder="ML Engineer · Python · Open Source"
            className={inputClass}
          />
        </div>
        <div>
          <Label>Bio</Label>
          <textarea
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="A sentence or two."
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <Label>Looking for</Label>
          <select
            value={form.looking_for}
            onChange={e => setForm(f => ({ ...f, looking_for: e.target.value }))}
            className={inputClass}
          >
            {LOOKING_FOR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section label="Character">
        {quiz?.completed_at ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Quiz: Completed
              </span>
              <span className="text-[var(--success)] text-xs">&check;</span>
              <Link
                to="/quiz"
                className="ml-auto text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
              >
                Retake
              </Link>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Style: {quiz.communication_style.charAt(0).toUpperCase() + quiz.communication_style.slice(1)} &middot; {quiz.work_style.charAt(0).toUpperCase() + quiz.work_style.slice(1)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Values: {quiz.core_values.join(' \u00b7 ')}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Quiz: Not taken yet
            </span>
            <Link
              to="/quiz"
              className="ml-auto text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
            >
              Take the character quiz &rarr;
            </Link>
            <span className="font-pixel text-[10px] text-[var(--text-tertiary)]">2 min</span>
          </div>
        )}
      </Section>

      <Section label="Skills">
        <TagInput
          tags={form.skills}
          onChange={skills => setForm(f => ({ ...f, skills }))}
          suggestions={SKILL_SUGGESTIONS}
          placeholder="Type a skill…"
          variant="skill"
        />
      </Section>

      <Section label="Interests">
        <TagInput
          tags={form.interests}
          onChange={interests => setForm(f => ({ ...f, interests }))}
          suggestions={INTEREST_SUGGESTIONS}
          placeholder="Type an interest…"
          variant="interest"
        />
      </Section>

      <Section label="Location">
        <div>
          <Label>Name</Label>
          <input
            type="text"
            value={form.location_name}
            onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
            placeholder="San Jose, CA"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Latitude</Label>
            <input
              type="number"
              step="any"
              value={form.latitude ?? ''}
              onChange={e => setForm(f => ({ ...f, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="37.3382"
              className={`${inputClass} font-pixel`}
            />
          </div>
          <div>
            <Label>Longitude</Label>
            <input
              type="number"
              step="any"
              value={form.longitude ?? ''}
              onChange={e => setForm(f => ({ ...f, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="-121.8863"
              className={`${inputClass} font-pixel`}
            />
          </div>
        </div>
        {location.latitude && (
          <button
            onClick={handleUseCurrentLocation}
            className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
          >
            Use current location →{' '}
            <span className="font-pixel text-xs text-[var(--text-tertiary)] no-underline">
              {location.locationName || `${location.latitude?.toFixed(3)}, ${location.longitude?.toFixed(3)}`}
            </span>
          </button>
        )}
      </Section>

      <Section label="Privacy">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.discovery_enabled}
            onChange={e => setForm(f => ({ ...f, discovery_enabled: e.target.checked }))}
            className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
          />
          <span className="flex-1">
            <span className="block text-sm text-[var(--text-primary)]">Show me in discovery</span>
            <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">
              When off, you are invisible to everyone — no one can find you nearby or see your
              profile until you turn this back on.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.show_photo_publicly}
            onChange={e => setForm(f => ({ ...f, show_photo_publicly: e.target.checked }))}
            className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
          />
          <span className="flex-1">
            <span className="block text-sm text-[var(--text-primary)]">Show my photo publicly</span>
            <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">
              When on, everyone can see your photo — even before connecting.
              Default is off. We believe in character-first connections.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.email_digest}
            onChange={e => setForm(f => ({ ...f, email_digest: e.target.checked }))}
            className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
          />
          <span className="flex-1">
            <span className="block text-sm text-[var(--text-primary)]">Weekly email digest</span>
            <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">
              Get a summary of new matches and your progress every Monday.
            </span>
          </span>
        </label>
      </Section>

      <Section label="Safety">
        <Link
          to="/settings/blocked"
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          Manage blocked users →
        </Link>
      </Section>

      <div className="flex items-center justify-between mt-12 pt-8 border-t border-[var(--border-strong)]">
        <button
          onClick={handleSignOut}
          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
        >
          Sign out
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-base text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save changes →'}
        </button>
      </div>

      <div className="mt-16 pt-8 border-t border-[var(--border-strong)]">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--danger)] mb-3">
          Danger zone
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-lg">
          Deleting your account hides your profile immediately, closes all your connections, and
          permanently erases your data after 30 days.
        </p>
        <button
          onClick={() => setDeleteModalOpen(true)}
          className="text-sm text-[var(--danger)] underline underline-offset-4 decoration-[var(--danger)] hover:decoration-[2px] transition-all"
        >
          Delete my account →
        </button>
      </div>

      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async () => {
          const result = await deleteAccount()
          if (!result.error) {
            navigate('/', { replace: true })
          }
          return result
        }}
      />
    </div>
  )
}
