/** @jest-environment node */

jest.mock('@/lib/google-account', () => ({ findGoogleAccountForScopes: jest.fn() }))
jest.mock('@/lib/google', () => ({ gmailService: { getUnreadCountForUser: jest.fn() } }))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))
jest.mock('@/lib/cognitive/get-or-create-twin', () => ({ getOrCreateTwin: jest.fn() }))
jest.mock('@/lib/cognitive/platform-signals', () => ({ persistNewPlatformSignals: jest.fn() }))
jest.mock('@/lib/ai/gmail-context', () => ({ isGmailReauthorizationError: jest.fn() }))

import { syncGmailPlugin } from '../gmail-plugin'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { gmailService } from '@/lib/google'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { isGmailReauthorizationError } from '@/lib/ai/gmail-context'

describe('Gmail ambient plugin', () => {
  beforeEach(() => jest.clearAllMocks())

  it('persists only a minimal aggregate inbox observation for the Twin', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'google-grant' })
    ;(gmailService.getUnreadCountForUser as jest.Mock).mockResolvedValue(53)

    await expect(syncGmailPlugin('user-1')).resolves.toMatchObject({ unreadCount: 53, unreadCountIsEstimate: true, signalsEmitted: 1 })
    expect(upsertNovoSignals).toHaveBeenCalledWith('user-1', [expect.objectContaining({
      source: 'gmail',
      sourceRef: 'inbox',
      signalType: 'unread_observed',
      label: 'Gmail inbox observed: about 53 unread messages',
      reliability: 'direct',
    })])
    expect(JSON.stringify((upsertNovoSignals as jest.Mock).mock.calls[0][1])).not.toContain('subject')
  })

  it('marks an expired or under-scoped Google grant for reauthorization', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'google-grant' })
    ;(gmailService.getUnreadCountForUser as jest.Mock).mockRejectedValue(new Error('insufficient permissions'))
    ;(isGmailReauthorizationError as jest.Mock).mockReturnValue(true)

    await expect(syncGmailPlugin('user-1')).resolves.toMatchObject({ error: 'reauthorization_required', signalsEmitted: 0 })
  })
})
