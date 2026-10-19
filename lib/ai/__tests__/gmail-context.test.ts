/** @jest-environment node */

jest.mock('@/lib/google-account', () => ({
  findGoogleAccountForScopes: jest.fn(),
}))
jest.mock('@/lib/google', () => ({
  gmailService: { searchForUser: jest.fn(), readThreadForUser: jest.fn(), readMessageForUser: jest.fn() },
}))
jest.mock('../mailbox-plan', () => ({ planMailboxRead: jest.fn().mockResolvedValue({ query: 'MESCyT', maxResults: 3, expandThread: false }) }))

import { getGmailContextForUser, isGmailReauthorizationError, shouldConsultGmail, shouldIncludeGmailSignal } from '../gmail-context'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { gmailService } from '@/lib/google'

describe('Gmail chat context', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads full message text from the owner grant when the user asks about mail', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.searchForUser as jest.Mock).mockResolvedValue({ messages: [
      { id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>', body: 'Full message text', bodyTruncated: false },
    ], nextPageToken: null })

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({
      status: 'available',
      messages: [{ id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>', body: 'Full message text', bodyTruncated: false }],
      query: 'MESCyT', hasMore: false, threadTruncated: false,
    })
    expect(gmailService.searchForUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ query: 'MESCyT', maxResults: 3 }))
  })

  it('reports a configured-but-temporarily-unavailable mailbox without claiming it is disconnected', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.searchForUser as jest.Mock).mockRejectedValue(new Error('provider error'))

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({ status: 'unavailable', messages: [] })
  })

  it('reports when Google requires Gmail authorization again after an insufficient-scope response', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.searchForUser as jest.Mock).mockRejectedValue({
      code: 403,
      errors: [{ reason: 'insufficientPermissions' }],
    })

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({
      status: 'reauthorization_required',
      messages: [],
    })
  })

  it('only consults Gmail when the user asks about email', () => {
    expect(shouldConsultGmail('Quiero que me digas mis correos más relevantes')).toBe(true)
    expect(shouldConsultGmail('¿Cuál es mi siguiente tarea?')).toBe(false)
    expect(shouldConsultGmail('Léelo completo y respóndele', [{ role: 'user', content: 'Revisa mis correos de MESCyT' }])).toBe(true)
    expect(shouldConsultGmail('Crea una tarea para mañana', [{ role: 'user', content: 'Revisa mis correos' }])).toBe(false)
  })

  it('bounds context text and explicitly marks a partial read', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.searchForUser as jest.Mock).mockResolvedValue({ messages: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, body: 'x'.repeat(20_000), bodyTruncated: false })), nextPageToken: 'more' })
    const context = await getGmailContextForUser('user-1')
    expect(context.messages.reduce((sum, item) => sum + item.body.length, 0)).toBeLessThanOrEqual(60_000)
    expect(context.messages.some(item => item.bodyTruncated)).toBe(true)
    expect(context.hasMore).toBe(true)
  })

  it('uses a live mailbox read instead of cached Gmail signals and drops stale counts', () => {
    expect(shouldIncludeGmailSignal(true, 'fresh')).toBe(false)
    expect(shouldIncludeGmailSignal(false, 'stale')).toBe(false)
    expect(shouldIncludeGmailSignal(false, 'fresh')).toBe(true)
  })

  it('recognizes a revoked Google refresh grant as requiring reauthorization', () => {
    expect(isGmailReauthorizationError({
      response: { status: 400, data: { error: 'invalid_grant' } },
    })).toBe(true)
    expect(isGmailReauthorizationError({
      response: { status: 403, data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } } },
    })).toBe(false)
  })
})
