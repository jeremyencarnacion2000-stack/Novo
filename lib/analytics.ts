/**
 * Client-side Analytics Tracking Functions
 * Use these to track user events from client components
 */

export async function trackEvent(
  userId: string,
  eventType: 'page_view' | 'task_complete' | 'routine_complete' | 'habit_complete' | 'reading_progress',
  module: string
) {
  try {
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trackEvent', userId, eventType, module })
    })
    if (!res.ok) throw new Error('Failed to track event')
  } catch (error) {
    console.error('Failed to track analytics event:', error)
  }
}

export async function startSession(userId: string, module: string) {
  try {
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'startSession', userId, module })
    })
    const data = await res.json()
    return data.sessionId ? { id: data.sessionId } : null
  } catch (error) {
    console.error('Failed to start session:', error)
    return null
  }
}

export async function endSession(sessionId: string) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'endSession', sessionId })
    })
  } catch (error) {
    console.error('Failed to end session:', error)
  }
}

export async function trackCompletion(
  userId: string,
  type: 'task' | 'routine' | 'habit',
  module: string
) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trackCompletion', userId, type, module })
    })
  } catch (error) {
    console.error('Failed to track completion:', error)
  }
}

/**
 * Note: getAnalyticsData and calculateProductivityMetrics have been moved to lib/analytics-server.ts
 * These functions should only be used in Server Components for direct Prisma access
 */