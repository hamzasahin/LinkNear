/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { rpcWithRetry } from '../lib/rpcRetry'
import { identify, resetAnalytics } from '../lib/analytics'
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../lib/errorTracking'
import type { Profile } from '../types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const bootstrappedProfileIds = new Set<string>()
const bootstrappingProfileIds = new Set<string>()

async function ensureProfileRow(user: User): Promise<void> {
  if (bootstrappedProfileIds.has(user.id) || bootstrappingProfileIds.has(user.id)) return

  bootstrappingProfileIds.add(user.id)

  try {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    if (!existing) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || null,
      })

      if (insertError) throw insertError
    }

    bootstrappedProfileIds.add(user.id)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap profile row:', error)
  } finally {
    bootstrappingProfileIds.delete(user.id)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Starts true. Any first render that observes `user` truthy must also
  // observe `profileLoading` truthy so the ProtectedRoute guard can hold
  // the spinner until fetchProfile settles. Cleared on sign-out and after
  // each fetchProfile completes.
  const [profileLoading, setProfileLoading] = useState(true)
  // Remember which user's profile we already loaded, so navigating between
  // authed pages doesn't trigger a refetch (fixes spinner flicker).
  const loadedForUserId = useRef<string | null>(null)

  const fetchProfile = useCallback(async (uid: string): Promise<void> => {
    setProfileLoading(true)
    try {
      // rpcWithRetry handles transient network failures (retry w/ backoff).
      // Non-transient failures (auth, RLS, schema) throw after the first try.
      const data = await rpcWithRetry<Profile | null>(() =>
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      )
      setProfile(data)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load profile:', e instanceof Error ? e.message : e)
      setProfile(null)
    } finally {
      // Mark the fetch as attempted regardless of outcome so the effect below
      // doesn't re-enter. If the profile ended up null due to an error the
      // ProtectedRoute guard will route to /onboarding — a fresh sign-in will
      // retry from scratch anyway.
      loadedForUserId.current = uid
      setProfileLoading(false)
    }
  }, [])

  const reloadProfile = useCallback(async () => {
    if (user?.id) {
      loadedForUserId.current = null // force refresh
      await fetchProfile(user.id)
    }
  }, [user?.id, fetchProfile])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        identify(session.user.id, { email: session.user.email, name: session.user.user_metadata?.full_name })
        setSentryUser(session.user.id, session.user.email)
        // IMPORTANT: flip profileLoading to true *synchronously* here, in the
        // same batched update as setUser, so the very first render that sees
        // `user` also sees `profileLoading=true`. Otherwise ProtectedRoute
        // briefly observes `user && !profile && !profileLoading` and routes
        // the user to /onboarding before fetchProfile has even started.
        setProfileLoading(true)
        // Deferred so we don't hold the auth listener lock longer than needed.
        window.setTimeout(() => {
          void ensureProfileRow(session.user)
        }, 0)
      } else {
        resetAnalytics()
        clearSentryUser()
        setProfile(null)
        setProfileLoading(false)
        loadedForUserId.current = null
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load profile exactly once per signed-in user. Downstream reads come
  // straight from context instead of hitting the DB on every navigation.
  useEffect(() => {
    if (!user) return
    if (loadedForUserId.current === user.id) return
    void fetchProfile(user.id)
  }, [user, fetchProfile])

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/',
      },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        signInWithEmail,
        signOut,
        reloadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
