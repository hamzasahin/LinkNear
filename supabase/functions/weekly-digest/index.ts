// Supabase Edge Function — Weekly Digest
// Triggered via cron job (Supabase dashboard) every Monday at 8am UTC
//
// Known limitation: the get_nearby_profiles RPC includes a rate-limit check
// that may interfere when called with the service role key. If digest delivery
// fails for certain users, verify that the RPC allows service-role calls or
// add a bypass for the `service_role` JWT claim inside the SQL function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ProfileRow {
  id: string
  full_name: string
  latitude: number
  longitude: number
  skills: string[]
  interests: string[]
  looking_for: string
  streak_count: number
}

interface NearbyRow {
  id: string
  full_name: string
  headline: string
  skills: string[]
  looking_for: string
  distance_km: number
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(s => s.toLowerCase()))
  return a.filter(s => setB.has(s.toLowerCase()))
}

function calculateSimpleMatchScore(user: ProfileRow, other: NearbyRow): number {
  let score = 0
  const shared = intersection(user.skills, other.skills)
  score += Math.min(shared.length * 10, 35)
  if (user.looking_for === other.looking_for) score += 15
  return Math.min(score, 100)
}

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all active users who want digests
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, latitude, longitude, skills, interests, looking_for, streak_count')
      .eq('email_digest', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .is('deleted_at', null)

    let sent = 0
    for (const user of users || []) {
      // Get user's email from auth
      const { data: authData } = await supabase.auth.admin.getUserById(user.id)
      if (!authData?.user?.email) continue

      // Find nearby profiles
      const { data: nearby } = await supabase.rpc('get_nearby_profiles', {
        user_lat: user.latitude,
        user_lng: user.longitude,
        radius_km: 8,
        p_limit: 10,
        p_offset: 0,
        p_looking_for: null,
      })

      if (!nearby?.length) continue

      // Score and pick top 3
      const scored = nearby
        .map((p: NearbyRow) => ({
          ...p,
          match_score: calculateSimpleMatchScore(user as ProfileRow, p),
          shared_skills: intersection(user.skills, p.skills),
        }))
        .sort((a: { match_score: number }, b: { match_score: number }) => b.match_score - a.match_score)
        .slice(0, 3)

      // Filter out already-connected
      const { data: connections } = await supabase
        .from('connections')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const connectedIds = new Set(
        (connections || []).flatMap((c: { sender_id: string; receiver_id: string }) => [c.sender_id, c.receiver_id])
      )

      const recommendations = scored.filter((p: { id: string }) => !connectedIds.has(p.id))
      if (recommendations.length === 0) continue

      // Get week's challenge stats
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { data: weekChallenges } = await supabase
        .from('user_challenges')
        .select('completed')
        .eq('user_id', user.id)
        .gte('assigned_date', weekAgo)

      const completedThisWeek = weekChallenges?.filter((c: { completed: boolean }) => c.completed).length || 0

      // Build email HTML
      const emailHtml = buildDigestEmail({
        userName: user.full_name,
        recommendations,
        completedThisWeek,
        streakCount: user.streak_count || 0,
        appUrl: 'https://linknear.vercel.app',
      })

      // Send via Resend (or log for now if no API key)
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'LinkNear <digest@linknear.app>',
            to: authData.user.email,
            subject: `${recommendations.length} people near you this week — LinkNear`,
            html: emailHtml,
          }),
        })
        sent++
      } else {
        console.log(`Would send digest to ${authData.user.email} (no RESEND_API_KEY)`)
        sent++
      }
    }

    return new Response(JSON.stringify({ status: 'ok', sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function buildDigestEmail({
  userName,
  recommendations,
  completedThisWeek,
  streakCount,
  appUrl,
}: {
  userName: string
  recommendations: Array<{
    full_name: string
    headline?: string
    distance_km: number
    match_score: number
    looking_for: string
    shared_skills: string[]
  }>
  completedThisWeek: number
  streakCount: number
  appUrl: string
}): string {
  const matchCards = recommendations
    .map(
      (r) => `
    <div style="background: #F5F0EB; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <div style="font-family: Georgia, serif; font-size: 20px; color: #1a1a1a; margin-bottom: 4px;">
        ${r.full_name}
      </div>
      <div style="font-family: monospace; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">
        ${r.headline || ''} · ${r.distance_km} km away · ${r.match_score}% match
      </div>
      ${
        r.shared_skills.length > 0
          ? `<div style="margin-top: 12px; font-size: 14px; color: #444;">
              <strong>Shared skills:</strong> ${r.shared_skills.join(', ')}
            </div>`
          : ''
      }
      <div style="margin-top: 8px; font-size: 14px; color: #444;">
        <strong>Looking for:</strong> ${r.looking_for}
      </div>
    </div>
  `
    )
    .join('')

  return `
    <div style="max-width: 500px; margin: 0 auto; font-family: 'DM Sans', sans-serif; color: #1a1a1a;">
      <div style="padding: 40px 24px;">
        <div style="font-family: Georgia, serif; font-size: 28px; margin-bottom: 8px;">
          LinkNear
        </div>
        <div style="font-size: 14px; color: #666; margin-bottom: 32px;">
          Your weekly digest
        </div>

        <div style="font-family: Georgia, serif; font-size: 22px; margin-bottom: 24px;">
          Hi ${userName}, here's who's nearby this week.
        </div>

        ${matchCards}

        <a href="${appUrl}/discover" style="display: inline-block; background: #D4654A; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Discover on LinkNear →
        </a>

        ${
          completedThisWeek > 0
            ? `
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #ddd;">
            <div style="font-family: monospace; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
              YOUR WEEK
            </div>
            <div style="font-size: 16px;">
              🎯 ${completedThisWeek} challenge${completedThisWeek > 1 ? 's' : ''} completed
              ${streakCount > 1 ? ` · 🔥 ${streakCount}-day streak` : ''}
            </div>
          </div>
        `
            : ''
        }

        <div style="margin-top: 40px; font-size: 12px; color: #999;">
          You're receiving this because you're on LinkNear.
          <a href="${appUrl}/settings" style="color: #999;">Unsubscribe</a>
        </div>
      </div>
    </div>
  `
}
