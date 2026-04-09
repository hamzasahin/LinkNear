import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLocation } from '../hooks/useLocation'
import { useFeed } from '../hooks/useFeed'
import Avatar from '../components/Avatar'
import type { FeedPost } from '../types'

const POST_TYPES = [
  { value: 'reflection', label: 'Reflection', icon: '\ud83d\udcad' },
  { value: 'gratitude', label: 'Gratitude', icon: '\ud83d\ude4f' },
  { value: 'learning', label: 'Learning', icon: '\ud83d\udcda' },
  { value: 'milestone', label: 'Milestone', icon: '\ud83c\udfc6' },
] as const

type ComposablePostType = (typeof POST_TYPES)[number]['value']

const BORDER_ACCENTS: Record<string, string> = {
  gratitude: 'border-l-4 border-l-[#b8860b]/40',
  learning: 'border-l-4 border-l-[#4a9fff]/30',
  milestone: 'border-l-4 border-l-[#daa520]/50',
}

const POST_TYPE_ICONS: Record<string, string> = {
  challenge_complete: '\ud83c\udfaf',
  reflection: '\ud83d\udcad',
  gratitude: '\ud83d\ude4f',
  learning: '\ud83d\udcda',
  milestone: '\ud83c\udfc6',
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth}mo ago`
}

const SEED_POSTS: { type: 'wisdom' | 'prompt'; content: string }[] = [
  { type: 'wisdom', content: '"The best of people are those most beneficial to people." — Sunan al-Daraqutni' },
  { type: 'prompt', content: 'What skill are you working on improving this week? Share your learning journey.' },
  { type: 'wisdom', content: '"We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Aristotle' },
  { type: 'prompt', content: 'Who was the last person who helped you grow? What did they teach you?' },
  { type: 'wisdom', content: '"A good word is charity." — Sahih al-Bukhari' },
  { type: 'prompt', content: "What's one thing you're grateful for in your career right now?" },
  { type: 'wisdom', content: '"The only way to do great work is to love what you do." — Steve Jobs' },
  { type: 'prompt', content: 'If you could master one new skill in the next 6 months, what would it be?' },
]

function SeedPostCard({ seed }: { seed: typeof SEED_POSTS[number] }) {
  return (
    <article className="border-t border-[var(--border)] pt-6 pl-2">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name="LinkNear" size="sm" />
        <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--accent-primary)]">
          LinkNear · {seed.type === 'wisdom' ? 'Wisdom' : 'Community prompt'}
        </span>
      </div>
      <p className={`text-sm leading-relaxed ${seed.type === 'wisdom' ? 'font-display text-base text-[var(--text-primary)] italic' : 'text-[var(--text-secondary)]'}`}>
        {seed.content}
      </p>
    </article>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
}: {
  post: FeedPost
  currentUserId: string
  onLike: (postId: string) => void
  onDelete: (postId: string) => void
}) {
  const initials = getInitials(post.full_name)
  const borderAccent = BORDER_ACCENTS[post.post_type] || ''
  const icon = POST_TYPE_ICONS[post.post_type] || ''
  const isOwn = post.user_id === currentUserId

  return (
    <article className={`py-6 px-4 ${borderAccent}`}>
      <div className="flex items-start gap-3">
        {/* Always initials, never photo */}
        <Avatar name={post.full_name} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm mb-1.5">
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {initials}
            </span>
            <span className="text-[var(--text-faint)]">&middot;</span>
            <span className="text-[var(--text-secondary)] truncate">{post.full_name}</span>
            <span className="text-[var(--text-faint)]">&middot;</span>
            <span className="text-[var(--text-tertiary)] text-xs flex-shrink-0">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          {post.post_type === 'challenge_complete' && post.challenge_title && (
            <div className="mb-2 px-3 py-2 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border)]">
              <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">
                {icon} Completed
              </p>
              <p className="text-sm text-[var(--text-primary)] font-medium">
                {post.challenge_title}
              </p>
              {post.challenge_source_text && (
                <p className="text-xs text-[var(--text-tertiary)] italic mt-1">
                  &ldquo;{post.challenge_source_text}&rdquo;
                  {post.challenge_source && (
                    <span className="not-italic"> &mdash; {post.challenge_source}</span>
                  )}
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {post.post_type !== 'challenge_complete' && icon && (
              <span className="mr-1">{icon}</span>
            )}
            {post.content}
          </p>

          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => onLike(post.post_id)}
              className="flex items-center gap-1.5 text-xs transition-colors group"
            >
              {post.liked_by_me ? (
                <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              )}
              {post.likes_count > 0 && (
                <span className={post.liked_by_me ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}>
                  {post.likes_count}
                </span>
              )}
            </button>

            {isOwn && (
              <button
                onClick={() => onDelete(post.post_id)}
                className="text-[var(--text-faint)] hover:text-[var(--danger)] transition-colors"
                aria-label="Delete post"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const { user } = useAuth()
  const { latitude, longitude, loading: locationLoading } = useLocation()
  const { posts, loading, error, hasMore, getFeed, loadMore, createPost, likePost, deletePost } = useFeed()

  const [composing, setComposing] = useState(false)
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<ComposablePostType>('reflection')
  const [posting, setPosting] = useState(false)

  const fetchFeed = useCallback(() => {
    if (latitude && longitude) {
      getFeed(latitude, longitude, 13) // ~8 miles
    }
  }, [latitude, longitude, getFeed])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  const handlePost = async () => {
    if (!user || !content.trim() || posting) return
    setPosting(true)
    try {
      await createPost(user.id, content, postType)
      setContent('')
      setComposing(false)
      setPostType('reflection')
      fetchFeed()
    } catch {
      // Error handled by hook
    } finally {
      setPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    if (!user) return
    try {
      await likePost(postId, user.id)
    } catch {
      // Silently fail
    }
  }

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId)
    } catch {
      // Silently fail
    }
  }

  const charCount = content.length
  const canPost = content.trim().length > 0 && charCount <= 500 && !posting

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <p className="font-pixel text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">
          Local
        </p>
        <h1 className="font-display text-3xl text-[var(--text-primary)] mb-1">Feed</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Posts from people nearby
        </p>
      </header>

      {/* Compose */}
      <div className="mb-8">
        {!composing ? (
          <button
            onClick={() => setComposing(true)}
            className="w-full text-left px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text-tertiary)] hover:border-[var(--border-strong)] transition-colors"
          >
            Compose a post...
          </button>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4">
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={500}
              rows={4}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] resize-none outline-none"
            />

            <div className="flex items-center justify-between mt-2 mb-3">
              <span className={`font-pixel text-[10px] ${charCount > 480 ? (charCount > 500 ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]') : 'text-[var(--text-faint)]'}`}>
                {charCount}/500
              </span>
            </div>

            <div className="mb-3">
              <p className="font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
                What are you sharing?
              </p>
              <div className="flex flex-wrap gap-2">
                {POST_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    onClick={() => setPostType(pt.value)}
                    className={`px-3 py-1.5 text-xs rounded-[var(--radius-md)] border transition-colors ${
                      postType === pt.value
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {pt.icon} {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setComposing(false); setContent(''); setPostType('reflection') }}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={!canPost}
                className={`text-sm transition-colors ${
                  canPost
                    ? 'text-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                    : 'text-[var(--text-faint)] cursor-not-allowed'
                }`}
              >
                {posting ? 'Posting...' : 'Post \u2192'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feed content */}
      {locationLoading ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-tertiary)]">Getting your location...</p>
        </div>
      ) : !latitude || !longitude ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-tertiary)]">
            Location access is needed to show your local feed.
          </p>
        </div>
      ) : loading && posts.length === 0 ? (
        <div className="space-y-0 divide-y divide-[var(--border)]">
          {[1, 2, 3].map(i => (
            <div key={i} className="py-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 skeleton rounded w-1/3" />
                  <div className="h-4 skeleton rounded w-full" />
                  <div className="h-4 skeleton rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-8">
          <p className="text-sm text-[var(--text-tertiary)] leading-relaxed max-w-xs mx-auto text-center mb-8">
            Your local feed is quiet. Complete today's challenge and share your reflection to start.
          </p>
          <div className="space-y-2">
            {SEED_POSTS.map((seed, i) => (
              <SeedPostCard key={i} seed={seed} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--border)]">
            {posts.map(post => (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={user?.id ?? ''}
                onLike={handleLike}
                onDelete={handleDelete}
              />
            ))}
            {posts.length < 5 && SEED_POSTS.slice(0, Math.max(0, 5 - posts.length)).map((seed, i) => (
              <SeedPostCard key={`seed-${i}`} seed={seed} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="text-sm text-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {loading ? 'Loading...' : 'Load more \u2192'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
