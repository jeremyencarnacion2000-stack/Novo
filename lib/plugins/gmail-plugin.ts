import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { gmailService } from '@/lib/google'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { isGmailReauthorizationError } from '@/lib/ai/gmail-context'

export interface GmailSyncResult {
  unreadCount: number
  signalsEmitted: number
  error?: 'not_connected' | 'unavailable' | 'reauthorization_required'
}

/**
 * Durable, privacy-minimal Gmail observation. This is not an email archive:
 * it stores the current unread aggregate only, while headers remain available
 * solely in the request-scoped chat path when the user asks for them.
 */
export async function syncGmailPlugin(userId: string, options: { signal?: AbortSignal } = {}): Promise<GmailSyncResult> {
  const account = await findGoogleAccountForScopes(userId, ['gmail.readonly'])
  if (!account) return { unreadCount: 0, signalsEmitted: 0, error: 'not_connected' }

  try {
    const unread = await gmailService.listUnreadForUser(userId, 50, options.signal)
    const now = new Date()
    await upsertNovoSignals(userId, [{
      source: 'gmail',
      sourceRef: 'inbox',
      signalType: 'unread_observed',
      label: `Gmail inbox observed: ${unread.length} unread messages`,
      observedAt: now,
      reliability: 'direct',
    }])

    return { unreadCount: unread.length, signalsEmitted: 1 }
  } catch (error) {
    return {
      unreadCount: 0,
      signalsEmitted: 0,
      error: isGmailReauthorizationError(error) ? 'reauthorization_required' : 'unavailable',
    }
  }
}
