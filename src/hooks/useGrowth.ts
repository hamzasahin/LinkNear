import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export interface ChallengeDay {
  assigned_date: string
  completed: boolean
  category: string | null
}

export interface CategoryStat {
  category: string
  count: number
}

export interface GrowthData {
  profile: Profile | null
  challengeHistory: ChallengeDay[]
  categoryStats: CategoryStat[]
  allCategories: Set<string>
}

const ALL_CATEGORIES = ['kindness', 'knowledge', 'community', 'self', 'generosity', 'gratitude']

export function useGrowth() {
  const getGrowthData = useCallback(async (userId: string): Promise<GrowthData> => {
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Last 12 weeks of challenge history for heatmap
    const twelveWeeksAgo = new Date()
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
    const dateStr = twelveWeeksAgo.toISOString().split('T')[0]

    const { data: history } = await supabase
      .from('user_challenges')
      .select('assigned_date, completed, challenge:challenges(category)')
      .eq('user_id', userId)
      .gte('assigned_date', dateStr)
      .order('assigned_date', { ascending: true })

    const challengeHistory: ChallengeDay[] = (history || []).map((row: Record<string, unknown>) => {
      const challenge = row.challenge as Record<string, unknown> | null
      return {
        assigned_date: row.assigned_date as string,
        completed: row.completed as boolean,
        category: challenge?.category as string | null ?? null,
      }
    })

    // Category stats — all completed challenges grouped by category
    const { data: catData } = await supabase
      .from('user_challenges')
      .select('challenge:challenges(category)')
      .eq('user_id', userId)
      .eq('completed', true)

    const catCounts: Record<string, number> = {}
    const allCategories = new Set<string>()
    for (const row of (catData || []) as Record<string, unknown>[]) {
      const challenge = row.challenge as Record<string, unknown> | null
      const cat = challenge?.category as string | null
      if (cat) {
        catCounts[cat] = (catCounts[cat] || 0) + 1
        allCategories.add(cat)
      }
    }

    const categoryStats: CategoryStat[] = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    return {
      profile: profile as Profile | null,
      challengeHistory,
      categoryStats,
      allCategories,
    }
  }, [])

  return { getGrowthData, ALL_CATEGORIES }
}
