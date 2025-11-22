


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

export async function getAnalyticsData(userId: string, days: number = 30) {
  try {
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAnalyticsData', userId, days })
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Failed to get analytics data:', error)
    return { dailyData: [], events: [] }
  }
}

export async function calculateProductivityMetrics(userId: string, days: number = 30) {
  try {
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calculateProductivityMetrics', userId, days })
    })
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Failed to calculate productivity metrics:', error)
    return null
  }
}