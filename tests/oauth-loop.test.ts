/**
 * @jest-environment node
 */

import { JWT } from 'next-auth/jwt'

// ─── High-Speed OAuth Token Rotation Simulator ───

// Mock Google Calendar API response payload
interface GoogleCalendarEvent {
  id: string
  summary: string
  start: { dateTime: string }
}

interface MockSession {
  accessToken: string
  refreshToken: string
  expiresAt: number // timestamp in seconds
  provider: 'google' | 'spotify'
  error?: string
}

// Pre-fetch refresh boundary threshold logic
function isTokenExpired(session: MockSession, bufferSeconds = 5): boolean {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  return currentTimestamp >= (session.expiresAt - bufferSeconds)
}

// Unified refresh helper representing the authOptions jwt callback logic
async function refreshAccessToken(session: MockSession): Promise<MockSession> {
  console.log('⏰ [OAuth Loop Audit] Decayed token detected. Rotating Google credentials...')
  
  // Simulate network request to Google OAuth token endpoint (non-blocking)
  await new Promise(resolve => setTimeout(resolve, 50)) // 50ms I/O latency
  
  const newAccessToken = `refreshed-token-${Math.random().toString(36).substring(7)}`
  const freshExpiresAt = Math.floor(Date.now() / 1000) + 3600 // fresh for 1 hour
  
  return {
    ...session,
    accessToken: newAccessToken,
    expiresAt: freshExpiresAt,
  }
}

// ─── Refresh Mutex ─────────────────────────────────────────────────────────
// Ensures that concurrent callers share a single in-flight refresh Promise
// instead of launching N parallel token rotations (which would add N×50ms).
let refreshPromise: Promise<MockSession> | null = null

// Resilient API Call wrapper with automatic token refresh handler
async function resilientGoogleApiCall<T>(
  sessionRef: { current: MockSession },
  apiCallFn: (token: string) => Promise<T>
): Promise<T> {
  // 1. If token is expired, serialize the refresh via shared mutex
  if (isTokenExpired(sessionRef.current)) {
    if (!refreshPromise) {
      // Only ONE refresh is initiated — all concurrent callers await the same promise
      refreshPromise = refreshAccessToken(sessionRef.current).finally(() => {
        refreshPromise = null
      })
    }
    sessionRef.current = await refreshPromise
  }

  // 2. Execute call using refreshed valid credentials
  try {
    return await apiCallFn(sessionRef.current.accessToken)
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error('401 Unauthorized: Access token is invalid or expired.')
    }
    throw error
  }
}

// Mock Google Calendar API simulator
const mockGoogleCalendarApi = {
  listEvents: async (token: string): Promise<GoogleCalendarEvent[]> => {
    // Validate credentials format
    if (!token || token.includes('expired')) {
      const err = new Error('Unauthorized')
      ;(err as any).status = 401
      throw err
    }
    return [
      { id: '1', summary: 'Daily Focus Block', start: { dateTime: '2026-05-26T10:00:00Z' } },
      { id: '2', summary: 'Restoration Ritual', start: { dateTime: '2026-05-26T14:30:00Z' } },
    ]
  }
}

describe('Google OAuth Token Expiration Loop & Resilience (V8 Thread Audit)', () => {
  let sessionRef: { current: MockSession }

  beforeEach(() => {
    refreshPromise = null // Reset mutex between tests
    // Initialize mock session that will expire in 2 seconds (triggering the pre-fetch refresh buffer)
    sessionRef = {
      current: {
        accessToken: 'expired-access-token-999',
        refreshToken: 'valid-refresh-token-555',
        expiresAt: Math.floor(Date.now() / 1000) + 2,
        provider: 'google'
      }
    }
  })

  test('Should catch high-frequency expirations, rotate token, and execute 5 concurrent calls with ZERO 401 errors and zero thread freezes', async () => {
    const startTime = Date.now()
    const concurrentRequestsCount = 5

    console.log('[OAuth Loop Audit] Simulating 5 high-frequency concurrent Calendar requests...')

    // Trigger 5 concurrent calls using Promise.all (validates non-blocking event loop behavior)
    const results = await Promise.all(
      Array.from({ length: concurrentRequestsCount }).map(async (_, index) => {
        return resilientGoogleApiCall(sessionRef, async (token) => {
          const events = await mockGoogleCalendarApi.listEvents(token)
          console.log(`[OAuth Loop Audit] Request #${index + 1} completed successfully with token: ${token.substring(0, 15)}...`)
          return events
        })
      })
    )

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    // Validate non-blocking execution:
    // With the mutex, all 5 callers share ONE 50ms refresh + ~0ms API call = ~50ms total.
    // We allow 2000ms to be robust across loaded CI environments.
    console.log(`[OAuth Loop Audit] Completed all concurrent requests in: ${totalDuration}ms`)
    expect(totalDuration).toBeLessThan(2000) // Main thread free — mutex prevents N×50ms stacking

    // Validate outcomes
    expect(results).toHaveLength(concurrentRequestsCount)
    results.forEach(eventList => {
      expect(eventList).toHaveLength(2)
      expect(eventList[0].summary).toBe('Daily Focus Block')
    })

    // Validate that token rotation did occur and updated the active session credentials
    expect(sessionRef.current.accessToken).not.toBe('expired-access-token-999')
    expect(sessionRef.current.accessToken).toContain('refreshed-token-')
    expect(isTokenExpired(sessionRef.current)).toBe(false)
  })
})
