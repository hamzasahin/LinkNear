// Friendly error message for rate limits
const RATE_LIMIT_MESSAGE = "You're exploring fast! Take a breath and try again in a moment."
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Checks if an error is a rate limit error.
 * Supabase rate limit errors can come in various forms:
 * - Error message containing 'rate' or 'limit'
 * - HTTP 429 status
 * - Custom check_rate_limit function errors
 */
export function isRateLimitError(error: { message?: string; code?: string; status?: number } | string): boolean {
  const msg = typeof error === 'string' ? error : (error.message || '')
  const msgLower = msg.toLowerCase()
  return (
    msgLower.includes('rate') ||
    msgLower.includes('limit reached') ||
    msgLower.includes('too many') ||
    (typeof error === 'object' && error.status === 429)
  )
}

/**
 * Returns a user-friendly error message.
 */
export function friendlyErrorMessage(error: { message?: string; code?: string; status?: number } | string): string {
  if (isRateLimitError(error)) return RATE_LIMIT_MESSAGE
  const msg = typeof error === 'string' ? error : (error.message || '')
  // Hide technical details from users
  if (msg.includes('PGRST') || msg.includes('pg_') || msg.includes('violates')) {
    return GENERIC_ERROR_MESSAGE
  }
  return msg || GENERIC_ERROR_MESSAGE
}
