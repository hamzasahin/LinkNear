import type { Profile, NearbyProfile, CharacterQuiz } from '../types'

export interface QuizPair {
  mine: CharacterQuiz | null
  theirs: CharacterQuiz | null
}

/**
 * Compatible work style pairs (bidirectional):
 * - researcher + executor
 * - collaborator + collaborator
 * - collaborator + independent
 * - flexible + anything
 */
function isWorkStyleCompatible(a: string, b: string): boolean {
  if (a === 'flexible' || b === 'flexible') return true
  if (a === b) return true
  const pair = [a, b].sort().join('+')
  const compatiblePairs = new Set([
    'executor+researcher',
    'collaborator+independent',
  ])
  return compatiblePairs.has(pair)
}

/**
 * Compatible communication style pairs:
 * - direct + diplomatic (balance)
 * - analytical + connector (balance)
 * - Same style = compatible
 * - balanced + anything
 */
function isCommStyleCompatible(a: string, b: string): boolean {
  if (a === 'balanced' || b === 'balanced') return true
  if (a === b) return true
  const pair = [a, b].sort().join('+')
  const compatiblePairs = new Set([
    'diplomatic+direct',
    'analytical+connector',
  ])
  return compatiblePairs.has(pair)
}

export function calculateMatchScore(
  myProfile: Profile,
  other: NearbyProfile,
  quizPair?: QuizPair
): number {
  let score = 0

  // Shared skills: up to 35 points (reduced from 40)
  const mySkills = new Set(myProfile.skills.map(s => s.toLowerCase()))
  const sharedSkills = other.skills.filter(s => mySkills.has(s.toLowerCase())).length
  score += Math.min(sharedSkills * 10, 35)

  // Shared interests: up to 30 points (reduced from 35)
  const myInterests = new Set(myProfile.interests.map(i => i.toLowerCase()))
  const sharedInterests = other.interests.filter(i => myInterests.has(i.toLowerCase())).length
  score += Math.min(sharedInterests * 7, 30)

  // Same looking_for: 15 points
  if (myProfile.looking_for === other.looking_for) {
    score += 15
  }

  // Is online: 5 points (reduced from 10)
  if (other.is_online) {
    score += 5
  }

  // Quiz bonus: up to 15 (only if BOTH users completed quiz)
  if (quizPair?.mine && quizPair?.theirs) {
    const mine = quizPair.mine
    const theirs = quizPair.theirs

    // Shared values: up to 9 (3 per shared value, max 3 counted)
    const myValues = new Set(mine.core_values.map(v => v.toLowerCase()))
    const sharedValues = theirs.core_values.filter(v => myValues.has(v.toLowerCase())).length
    score += Math.min(sharedValues, 3) * 3

    // Compatible work styles: up to 3
    if (isWorkStyleCompatible(mine.work_style, theirs.work_style)) {
      score += 3
    }

    // Compatible communication styles: up to 3
    if (isCommStyleCompatible(mine.communication_style, theirs.communication_style)) {
      score += 3
    }
  }

  return Math.min(score, 100)
}
