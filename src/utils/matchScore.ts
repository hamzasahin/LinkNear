import type { Profile, NearbyProfile } from '../types'

export function calculateMatchScore(myProfile: Profile, other: NearbyProfile): number {
  let score = 0

  // Shared skills: up to 40 points
  const mySkills = new Set(myProfile.skills.map(s => s.toLowerCase()))
  const sharedSkills = other.skills.filter(s => mySkills.has(s.toLowerCase())).length
  score += Math.min(sharedSkills * 10, 40)

  // Shared interests: up to 35 points
  const myInterests = new Set(myProfile.interests.map(i => i.toLowerCase()))
  const sharedInterests = other.interests.filter(i => myInterests.has(i.toLowerCase())).length
  score += Math.min(sharedInterests * 7, 35)

  // Same looking_for: 15 points
  if (myProfile.looking_for === other.looking_for) {
    score += 15
  }

  // Is online: 10 points
  if (other.is_online) {
    score += 10
  }

  return Math.min(score, 100)
}
