import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Challenge, UserChallenge } from '../types'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getStreakMultiplier(streak: number): number {
  if (streak >= 31) return 2
  if (streak >= 15) return 1.5
  if (streak >= 8) return 1.25
  return 1
}

export function useChallenges() {
  const getDailyChallenge = useCallback(async (userId: string): Promise<(UserChallenge & { challenge: Challenge }) | null> => {
    const today = todayDateString()
    const { data, error } = await supabase
      .from('user_challenges')
      .select('*, challenge:challenges(*)')
      .eq('user_id', userId)
      .eq('assigned_date', today)
      .maybeSingle()

    if (error) {
      console.error('getDailyChallenge error:', error)
      return null
    }
    return data as (UserChallenge & { challenge: Challenge }) | null
  }, [])

  const getOrAssignDailyChallenge = useCallback(async (userId: string): Promise<(UserChallenge & { challenge: Challenge }) | null> => {
    // Check if already assigned today
    const existing = await getDailyChallenge(userId)
    if (existing) return existing

    const today = todayDateString()

    // Get IDs of challenges assigned in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: recentAssignments } = await supabase
      .from('user_challenges')
      .select('challenge_id, challenge:challenges(category)')
      .eq('user_id', userId)
      .gte('assigned_date', thirtyDaysAgo.toISOString().slice(0, 10))
      .order('assigned_date', { ascending: false })

    const recentChallengeIds = new Set(
      (recentAssignments || []).map((a: Record<string, unknown>) => a.challenge_id as string)
    )

    // Get last 2 categories to avoid repeats
    const recentCategories = new Set(
      (recentAssignments || [])
        .slice(0, 2)
        .map((a: Record<string, unknown>) => {
          const ch = a.challenge as Record<string, unknown> | Record<string, unknown>[] | null
          if (!ch) return undefined
          // Supabase may return joined row as object or array
          if (Array.isArray(ch)) return ch[0]?.category as string | undefined
          return ch.category as string | undefined
        })
        .filter(Boolean)
    )

    // Fetch all active challenges
    const { data: allChallenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_active', true)

    if (fetchErr || !allChallenges || allChallenges.length === 0) {
      console.error('Failed to fetch challenges:', fetchErr)
      return null
    }

    // Filter: prefer challenges not assigned recently and not in last 2 categories
    let candidates = allChallenges.filter(
      (c: Challenge) => !recentChallengeIds.has(c.id) && !recentCategories.has(c.category)
    )

    // Relax: allow recent categories if too few candidates
    if (candidates.length === 0) {
      candidates = allChallenges.filter(
        (c: Challenge) => !recentChallengeIds.has(c.id)
      )
    }

    // Last resort: pick from all
    if (candidates.length === 0) {
      candidates = allChallenges
    }

    // Random pick
    const picked = candidates[Math.floor(Math.random() * candidates.length)] as Challenge

    // Insert assignment
    const { data: inserted, error: insertErr } = await supabase
      .from('user_challenges')
      .insert({
        user_id: userId,
        challenge_id: picked.id,
        assigned_date: today,
      })
      .select('*, challenge:challenges(*)')
      .single()

    if (insertErr) {
      console.error('Failed to assign challenge:', insertErr)
      // Might be a race condition (UNIQUE constraint), try reading again
      return await getDailyChallenge(userId)
    }

    return inserted as UserChallenge & { challenge: Challenge }
  }, [getDailyChallenge])

  const completeChallenge = useCallback(async (
    userId: string,
    userChallengeId: string,
    challengePoints: number,
    reflection?: string,
    shareToFeed?: boolean,
  ): Promise<{ success: boolean; pointsEarned: number; streakBonus: boolean }> => {
    const today = todayDateString()
    const yesterday = yesterdayDateString()

    // Mark the user_challenge as completed
    const { error: updateErr } = await supabase
      .from('user_challenges')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        reflection: reflection || null,
        shared_to_feed: shareToFeed || false,
      })
      .eq('id', userChallengeId)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('Failed to complete challenge:', updateErr)
      return { success: false, pointsEarned: 0, streakBonus: false }
    }

    // Fetch current profile streak data
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_count, longest_streak, total_points, challenges_completed, last_challenge_date')
      .eq('id', userId)
      .single()

    const currentStreak = profile?.streak_count || 0
    const currentLongest = profile?.longest_streak || 0
    const currentPoints = profile?.total_points || 0
    const currentCompleted = profile?.challenges_completed || 0
    const lastDate = profile?.last_challenge_date

    // Calculate new streak
    let newStreak: number
    if (lastDate === yesterday) {
      newStreak = currentStreak + 1
    } else if (lastDate === today) {
      // Already completed today (edge case), keep streak
      newStreak = currentStreak
    } else {
      newStreak = 1
    }

    const streakBonus = newStreak > 1
    const multiplier = getStreakMultiplier(newStreak)
    const pointsEarned = Math.round(challengePoints * multiplier)

    // Update profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        streak_count: newStreak,
        longest_streak: Math.max(newStreak, currentLongest),
        total_points: currentPoints + pointsEarned,
        challenges_completed: currentCompleted + 1,
        last_challenge_date: today,
      })
      .eq('id', userId)

    if (profileErr) {
      console.error('Failed to update profile streak:', profileErr)
    }

    return { success: true, pointsEarned, streakBonus }
  }, [])

  return { getDailyChallenge, getOrAssignDailyChallenge, completeChallenge }
}
