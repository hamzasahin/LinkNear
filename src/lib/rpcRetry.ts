/**
 * Thin wrapper around Supabase RPC calls that retries transient network
 * failures with exponential backoff.
 *
 * Supabase's `.rpc(...)` and `.from(...).select(...)` calls return a thenable
 * with shape `{ data, error }`. We treat `error` as a failure and retry up to
 * `maxAttempts` times, but only for network-ish errors (no HTTP response).
 * Business-logic errors (rate limit, not-authorized, check-violation) are
 * thrown immediately so the caller can surface them.
 */

import { friendlyErrorMessage } from './supabaseHelpers'
import { captureError } from './errorTracking'

export interface RpcResponse<T> {
  data: T | null
  error: { message: string; code?: string; details?: string } | null
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  /** Return true to retry, false to throw immediately. */
  shouldRetry?: (error: { message: string; code?: string }) => boolean
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 300

const TRANSIENT_CODES = new Set(['PGRST000', 'PGRST001', 'ECONNRESET', 'ETIMEDOUT'])
const TRANSIENT_MESSAGE_FRAGMENTS = [
  'fetch',
  'network',
  'failed to fetch',
  'load failed',
  'timeout',
]

function defaultShouldRetry(error: { message: string; code?: string }): boolean {
  if (error.code && TRANSIENT_CODES.has(error.code)) return true
  const msg = (error.message || '').toLowerCase()
  return TRANSIENT_MESSAGE_FRAGMENTS.some(fragment => msg.includes(fragment))
}

/**
 * Wraps a Supabase query thenable and retries transient failures.
 * Throws an Error with the Supabase error message on final failure.
 */
export async function rpcWithRetry<T>(
  call: () => PromiseLike<RpcResponse<T>>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry

  let lastErrorMessage = 'unknown error'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await call()
    if (!error) {
      return data as T
    }

    lastErrorMessage = error.message || 'rpc failed'

    // Non-retriable: throw immediately so the UI can surface the real reason.
    if (!shouldRetry(error) || attempt === maxAttempts) {
      const err = new Error(friendlyErrorMessage(error))
      // @ts-expect-error — preserve original code for callers that want it
      err.code = error.code
      captureError(err, { code: error.code, details: error.details })
      throw err
    }

    const delay = baseDelayMs * Math.pow(2, attempt - 1)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  throw new Error(friendlyErrorMessage(lastErrorMessage))
}
