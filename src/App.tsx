import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useProfile } from './hooks/useProfile'
import type { Profile } from './types'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DiscoverPage from './pages/DiscoverPage'
import ProfilePage from './pages/ProfilePage'
import ConnectionsPage from './pages/ConnectionsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { getMyProfile } = useProfile()
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (!loading && user) {
      getMyProfile().then(p => {
        setProfile(p)
        setProfileLoading(false)
      })
    } else if (!loading && !user) {
      setProfileLoading(false)
    }
  }, [loading, user])

  if (loading || profileLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // If profile has no skills, redirect to onboarding
  if (profile !== undefined && (!profile?.skills || profile.skills.length === 0)) {
    return <Navigate to="/onboarding" replace />
  }

  return <Layout>{children}</Layout>
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner fullScreen message="Loading..." />
  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:id"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <ConnectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  )
}
