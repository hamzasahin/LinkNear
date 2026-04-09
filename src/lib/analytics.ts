import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: 'https://us.i.posthog.com',
      autocapture: true,
      capture_pageview: true,
      persistence: 'memory', // respect privacy — no cookies
    })
  }
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY) posthog.identify(userId, properties)
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY) posthog.capture(event, properties)
}

export function resetAnalytics() {
  if (POSTHOG_KEY) posthog.reset()
}
