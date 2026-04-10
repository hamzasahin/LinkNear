import * as Sentry from '@sentry/react'

export function initErrorTracking() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
    })
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context })
}

export function setUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email })
}

export function clearUser() {
  Sentry.setUser(null)
}
