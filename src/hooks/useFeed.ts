import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { FeedPost } from '../types'

const PAGE_SIZE = 20

interface UseFeedReturn {
  posts: FeedPost[]
  loading: boolean
  error: string | null
  hasMore: boolean
  getFeed: (lat: number, lng: number, radiusKm?: number, limit?: number, offset?: number) => Promise<void>
  loadMore: () => Promise<void>
  createPost: (userId: string, content: string, postType: string, challengeId?: string) => Promise<void>
  likePost: (postId: string, userId: string) => Promise<void>
  deletePost: (postId: string) => Promise<void>
}

export function useFeed(): UseFeedReturn {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const lastParams = useRef<{ lat: number; lng: number; radiusKm: number } | null>(null)
  const offsetRef = useRef(0)

  const enrichWithLikes = useCallback(async (feedPosts: FeedPost[]): Promise<FeedPost[]> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || feedPosts.length === 0) return feedPosts

    const postIds = feedPosts.map(p => p.post_id)
    const { data: likes } = await supabase
      .from('feed_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)

    const likedSet = new Set((likes ?? []).map(l => l.post_id))
    return feedPosts.map(p => ({
      ...p,
      liked_by_me: likedSet.has(p.post_id),
    }))
  }, [])

  const getFeed = useCallback(async (
    lat: number,
    lng: number,
    radiusKm = 8,
    limit = PAGE_SIZE,
    offset = 0,
  ) => {
    setLoading(true)
    setError(null)
    offsetRef.current = 0
    lastParams.current = { lat, lng, radiusKm }

    try {
      const { data, error: rpcError } = await supabase.rpc('get_local_feed', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radiusKm,
        page_limit: limit,
        page_offset: offset,
      })

      if (rpcError) throw rpcError

      const enriched = await enrichWithLikes((data ?? []) as FeedPost[])
      setPosts(enriched)
      setHasMore((data ?? []).length === PAGE_SIZE)
      offsetRef.current = enriched.length
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPosts([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [enrichWithLikes])

  const loadMore = useCallback(async () => {
    const params = lastParams.current
    if (!params || loading || !hasMore) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_local_feed', {
        user_lat: params.lat,
        user_lng: params.lng,
        radius_km: params.radiusKm,
        page_limit: PAGE_SIZE,
        page_offset: offsetRef.current,
      })

      if (rpcError) throw rpcError

      const enriched = await enrichWithLikes((data ?? []) as FeedPost[])
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.post_id))
        const fresh = enriched.filter(p => !seen.has(p.post_id))
        return [...prev, ...fresh]
      })
      setHasMore((data ?? []).length === PAGE_SIZE)
      offsetRef.current += enriched.length
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [enrichWithLikes, hasMore, loading])

  const createPost = useCallback(async (
    userId: string,
    content: string,
    postType: string,
    challengeId?: string,
  ) => {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 500) {
      throw new Error('Content must be between 1 and 500 characters.')
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      content: trimmed,
      post_type: postType,
    }
    if (challengeId) row.challenge_id = challengeId

    const { error: insertError } = await supabase.from('feed_posts').insert(row)
    if (insertError) throw insertError
  }, [])

  const likePost = useCallback(async (postId: string, userId: string) => {
    // Toggle: check if already liked
    const { data: existing } = await supabase
      .from('feed_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const { error: deleteError } = await supabase
        .from('feed_likes')
        .delete()
        .eq('id', existing.id)
      if (deleteError) throw deleteError

      // Update local state
      setPosts(prev => prev.map(p =>
        p.post_id === postId
          ? { ...p, liked_by_me: false, likes_count: Math.max(0, p.likes_count - 1) }
          : p
      ))
    } else {
      const { error: insertError } = await supabase
        .from('feed_likes')
        .insert({ post_id: postId, user_id: userId })
      if (insertError) throw insertError

      // Update local state
      setPosts(prev => prev.map(p =>
        p.post_id === postId
          ? { ...p, liked_by_me: true, likes_count: p.likes_count + 1 }
          : p
      ))
    }
  }, [])

  const deletePost = useCallback(async (postId: string) => {
    const { error: deleteError } = await supabase
      .from('feed_posts')
      .delete()
      .eq('id', postId)
    if (deleteError) throw deleteError

    setPosts(prev => prev.filter(p => p.post_id !== postId))
  }, [])

  return { posts, loading, error, hasMore, getFeed, loadMore, createPost, likePost, deletePost }
}
