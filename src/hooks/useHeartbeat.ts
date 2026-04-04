import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const HEARTBEAT_INTERVAL_MS = 60_000

/**
 * Updates `last_seen` for the current user every 60 seconds while the app is
 * in the foreground. Also fires on window focus and tab visibility changes
 * so presence stays fresh as users switch between tabs.
 *
 * Call once from a top-level layout component so every authenticated page
 * benefits without duplicating the interval.
 *
 * The server-side `touch_presence` RPC buckets `last_seen` to 5-minute floors
 * to defeat timing side-channel stalking.
 */
export function useHeartbeat(): void {
  const { user } = useAuth()
  const intervalRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!user) return

    const touch = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        await supabase.rpc('touch_presence')
      } catch {
        // Swallow — presence is best-effort, never surface errors to the user.
      } finally {
        inFlightRef.current = false
      }
    }

    // Immediate beat so the user shows up as online right after login.
    touch()

    intervalRef.current = window.setInterval(touch, HEARTBEAT_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') touch()
    }
    const handleFocus = () => touch()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])
}
