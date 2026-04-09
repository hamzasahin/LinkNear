import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DiscoverPage from './pages/DiscoverPage'
import ProfilePage from './pages/ProfilePage'
import ConnectionsPage from './pages/ConnectionsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import ChatPage from './pages/ChatPage'
import InboxPage from './pages/InboxPage'
import BlockedUsersPage from './pages/BlockedUsersPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import ErrorFallbackPage from './pages/ErrorFallbackPage'
import PosterPage from './pages/PosterPage'
import ChallengeCardsPage from './pages/ChallengeCardsPage'

// Lazy-loaded pages (not needed on every session)
const FeedPage = lazy(() => import('./pages/FeedPage'))
const GrowthPage = lazy(() => import('./pages/GrowthPage'))
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading } = useAuth()

  // Wait for both the auth handshake AND the first profile load for this
  // user. Once the profile is cached in AuthContext, subsequent navigations
  // return instantly (no refetch, no flicker).
  if (loading || (user && profileLoading && !profile)) {
    return <LoadingSpinner fullScreen message="Loading..." />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // If the profile has no skills (fresh signup), force through onboarding.
  if (!profile?.skills || profile.skills.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  return <Layout>{children}</Layout>
}

/** Like ProtectedRoute but without Layout (no bottom nav). */
function ProtectedRouteNoLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading } = useAuth()

  if (loading || (user && profileLoading && !profile)) {
    return <LoadingSpinner fullScreen message="Loading..." />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!profile?.skills || profile.skills.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner fullScreen message="Loading..." />
  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallbackPage />}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
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
          path="/feed"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner message="Loading..." />}><FeedPage /></Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/growth"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner message="Loading..." />}><GrowthPage /></Suspense>
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
          path="/messages"
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:connectionId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner message="Loading..." />}><MyProfilePage /></Suspense>
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
        <Route
          path="/settings/blocked"
          element={
            <ProtectedRoute>
              <BlockedUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRouteNoLayout>
              <Suspense fallback={<LoadingSpinner message="Loading..." />}><QuizPage /></Suspense>
            </ProtectedRouteNoLayout>
          }
        />
        <Route path="/poster" element={<PosterPage />} />
        <Route path="/cards" element={<ChallengeCardsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}
