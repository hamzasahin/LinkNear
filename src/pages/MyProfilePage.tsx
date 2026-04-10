import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useQuiz } from '../hooks/useQuiz'
import { supabase } from '../lib/supabase'
import type { Profile, CharacterQuiz, FeedPost } from '../types'
import Avatar from '../components/Avatar'
import TagChip from '../components/TagChip'
import LoadingSpinner from '../components/LoadingSpinner'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-4">
      {children}
    </p>
  )
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

const POST_TYPE_ICON: Record<string, string> = {
  challenge_complete: '🎯',
  reflection: '💭',
  gratitude: '🙏',
  learning: '📚',
  milestone: '🏆',
}

export default function MyProfilePage() {
  const { user } = useAuth()
  const { getMyProfile } = useProfile()
  const { getQuiz } = useQuiz()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [quiz, setQuiz] = useState<CharacterQuiz | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      getMyProfile().then(p => setProfile(p)),
      getQuiz(user.id).then(q => setQuiz(q)),
      supabase
        .from('feed_posts')
        .select('id, user_id, content, post_type, challenge_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) {
            setPosts(data.map(p => ({
              post_id: p.id,
              user_id: p.user_id,
              full_name: '',
              headline: '',
              avatar_url: null,
              show_photo_publicly: false,
              content: p.content,
              post_type: p.post_type as FeedPost['post_type'],
              challenge_title: null,
              challenge_source: null,
              challenge_source_text: null,
              likes_count: 0,
              created_at: p.created_at,
            })))
          }
        }),
    ]).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (loading) return <LoadingSpinner message="Loading profile" />
  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex items-start gap-6 mb-10">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">
            Profile
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] leading-[1.05] mb-2">
            {profile.full_name}
          </h1>
          {profile.headline && (
            <p className="text-[var(--text-secondary)] text-base mb-3">{profile.headline}</p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {profile.location_name && <span>{profile.location_name}</span>}
            {profile.looking_for && <span>Looking for {profile.looking_for.replace('-', ' ')}</span>}
          </div>
          <Link
            to="/settings"
            className="inline-block mt-4 text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
          >
            Edit profile →
          </Link>
        </div>
      </header>

      {/* Growth stats */}
      <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
        <SectionLabel>Growth</SectionLabel>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4 text-center">
            <p className="text-2xl text-[var(--text-primary)] mb-1">{profile.streak_count || 0}</p>
            <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">day streak</p>
          </div>
          <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4 text-center">
            <p className="text-2xl text-[var(--text-primary)] mb-1">{profile.total_points || 0}</p>
            <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">total points</p>
          </div>
          <div className="border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4 text-center">
            <p className="text-2xl text-[var(--text-primary)] mb-1">{profile.challenges_completed || 0}</p>
            <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">challenges</p>
          </div>
        </div>
        <Link
          to="/growth"
          className="text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all"
        >
          View full growth journey →
        </Link>
      </section>

      {/* Character */}
      {quiz?.completed_at && (
        <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
          <SectionLabel>Character</SectionLabel>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {quiz.communication_style.charAt(0).toUpperCase() + quiz.communication_style.slice(1)} · {quiz.work_style.charAt(0).toUpperCase() + quiz.work_style.slice(1)}
          </p>
          <div className="flex flex-wrap gap-2">
            {quiz.core_values.map(v => (
              <span
                key={v}
                className="inline-block rounded-[var(--radius-md)] px-2.5 py-1 border border-[var(--border-strong)] font-pixel text-[10px] uppercase tracking-[0.06em] text-[var(--text-secondary)]"
              >
                {v}
              </span>
            ))}
          </div>
        </section>
      )}

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

      {/* My Posts */}
      <section className="border-t border-[var(--border-strong)] pt-8 mb-10">
        <SectionLabel>My posts</SectionLabel>
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No posts yet. Share a reflection on the{' '}
            <Link to="/feed" className="text-[var(--accent-primary)] underline underline-offset-4">
              Feed
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <div
                key={post.post_id}
                className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex items-center gap-2 mb-2 font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  <span>{POST_TYPE_ICON[post.post_type] || '💭'}</span>
                  <span>{post.post_type.replace('_', ' ')}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(post.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {post.content}
                </p>
              </div>
            ))}
            {posts.length >= 10 && (
              <Link
                to="/feed"
                className="block text-sm text-[var(--accent-primary)] underline underline-offset-4 decoration-[var(--accent-primary)] hover:decoration-[2px] transition-all mt-4"
              >
                See all on Feed →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
