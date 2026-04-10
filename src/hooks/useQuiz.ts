import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CharacterQuiz } from '../types'

type CommunicationStyle = CharacterQuiz['communication_style']
type WorkStyle = CharacterQuiz['work_style']

/**
 * Derive communication_style, work_style, and core_values from raw quiz answers.
 */
export function processQuizAnswers(answers: Record<string, string>): {
  communication_style: CommunicationStyle
  work_style: WorkStyle
  core_values: string[]
} {
  // --- work_style from Q1 + Q2 ---
  const q1Map: Record<string, WorkStyle> = {
    research: 'researcher',
    iterate: 'executor',
    plan: 'executor',
    ask: 'collaborator',
  }
  const q2Map: Record<string, WorkStyle> = {
    brainstorm: 'collaborator',
    leader: 'executor',
    independent: 'independent',
    rotating: 'collaborator',
  }

  const ws1 = q1Map[answers.q1] ?? 'flexible'
  const ws2 = q2Map[answers.q2] ?? 'flexible'
  let work_style: WorkStyle = 'flexible'
  if (ws1 === ws2) {
    work_style = ws1
  } else if (ws1 === 'flexible') {
    work_style = ws2
  } else if (ws2 === 'flexible') {
    work_style = ws1
  }

  // --- communication_style from Q3 + Q4 ---
  const q3Map: Record<string, CommunicationStyle> = {
    direct: 'direct',
    diplomatic: 'diplomatic',
    questions: 'analytical',
    letgo: 'diplomatic',
  }
  const q4Map: Record<string, CommunicationStyle> = {
    energized: 'connector',
    selective: 'analytical',
    observer: 'analytical',
    connector: 'connector',
  }

  const cs1 = q3Map[answers.q3] ?? 'balanced'
  const cs2 = q4Map[answers.q4] ?? 'balanced'
  let communication_style: CommunicationStyle = 'balanced'
  if (cs1 === cs2) {
    communication_style = cs1
  } else if (cs1 === 'balanced') {
    communication_style = cs2
  } else if (cs2 === 'balanced') {
    communication_style = cs1
  }

  // --- core_values from Q7 + Q8 + Q9 + Q10 ---
  const q7Map: Record<string, string> = {
    build: 'Creativity',
    help: 'Service',
    master: 'Excellence',
    connect: 'Community',
  }
  const q8Map: Record<string, string> = {
    create: 'Creativity',
    learn: 'Knowledge',
    serve: 'Service',
    people: 'Community',
  }
  const q9Map: Record<string, string> = {
    project: 'Creativity',
    travel: 'Freedom',
    volunteer: 'Service',
    study: 'Knowledge',
  }

  // Count occurrences from Q7-Q9
  const valueCounts: Record<string, number> = {}
  for (const val of [q7Map[answers.q7], q8Map[answers.q8], q9Map[answers.q9]]) {
    if (val) {
      valueCounts[val] = (valueCounts[val] || 0) + 1
    }
  }

  // Q10 is a comma-separated list of 3 values
  const q10Values = answers.q10 ? answers.q10.split(',').map(v => v.trim()).filter(Boolean) : []

  // Combine: take Q10 values + any values that appeared 2+ times in Q7-Q9
  const inferredValues = Object.entries(valueCounts)
    .filter(([, count]) => count >= 2)
    .map(([val]) => val)

  const combined = new Set([...q10Values, ...inferredValues])
  // Cap at 5 total
  const core_values = Array.from(combined).slice(0, 5)

  return { communication_style, work_style, core_values }
}

export function useQuiz() {
  const getQuiz = useCallback(async (userId: string): Promise<CharacterQuiz | null> => {
    const { data, error } = await supabase
      .from('character_quiz')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return null
    return data as CharacterQuiz | null
  }, [])

  const saveQuiz = useCallback(async (
    userId: string,
    answers: Record<string, string>
  ): Promise<{ data: CharacterQuiz | null; error: string | null }> => {
    const derived = processQuizAnswers(answers)

    const payload = {
      user_id: userId,
      core_values: derived.core_values,
      communication_style: derived.communication_style,
      work_style: derived.work_style,
      raw_answers: answers,
      completed_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('character_quiz')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    // Set quiz_completed on profile
    await supabase
      .from('profiles')
      .update({ quiz_completed: true })
      .eq('id', userId)

    return { data: data as CharacterQuiz, error: null }
  }, [])

  return { getQuiz, saveQuiz, processQuizAnswers }
}
