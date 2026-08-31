/** @jest-environment node */

jest.mock('@/lib/google-account', () => ({ findGoogleAccountForScopes: jest.fn() }))
jest.mock('@/lib/google', () => ({ gmailService: { listUnreadForUser: jest.fn() } }))
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
    ;(gmailService.listUnreadForUser as jest.Mock).mockResolvedValue([
      { id: 'mail-1', subject: 'Private subject', from: 'private@example.test' },
      { id: 'mail-2', subject: 'Another private subject', from: 'another@example.test' },
    ])

    await expect(syncGmailPlugin('user-1')).resolves.toMatchObject({ unreadCount: 2, signalsEmitted: 1 })
    expect(upsertNovoSignals).toHaveBeenCalledWith('user-1', [expect.objectContaining({
      source: 'gmail',
      sourceRef: 'inbox',
      signalType: 'unread_observed',
      label: 'Gmail inbox observed: 2 unread messages',
      reliability: 'direct',
    })])
    expect(JSON.stringify((upsertNovoSignals as jest.Mock).mock.calls[0][1])).not.toContain('Private subject')
  })

  it('marks an expired or under-scoped Google grant for reauthorization', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'google-grant' })
    ;(gmailService.listUnreadForUser as jest.Mock).mockRejectedValue(new Error('insufficient permissions'))
    ;(isGmailReauthorizationError as jest.Mock).mockReturnValue(true)

    await expect(syncGmailPlugin('user-1')).resolves.toMatchObject({ error: 'reauthorization_required', signalsEmitted: 0 })
  })
})
