import { trackEvent } from './analytics'

export async function trackActivity(
  type: 'task' | 'routine' | 'habit',
  completed: boolean = true,
  metadata?: { id?: string; name?: string; module?: string }
) {
  if (!completed) return

  try {
    // Use the centralized trackEvent which is more robust
    await trackEvent(
      undefined, // userId will be picked up from session on server
      `${type}_complete` as any,
      metadata?.module || type
    )
  } catch (error) {
    console.error('Failed to track activity:', error)
  }
}

export async function getStreak(): Promise<number> {
  try {
    const response = await fetch('/api/analytics?type=streak')
    if (response.ok) {
      const data = await response.json()
      return data.streak || 0
    }
    return 0
  } catch (error) {
    console.error('Failed to get streak:', error)
    return 0
  }
}
