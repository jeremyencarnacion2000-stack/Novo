/** @jest-environment node */

jest.mock('@/lib/google-account', () => ({
  findGoogleAccountForScopes: jest.fn(),
}))
jest.mock('@/lib/google', () => ({
  gmailService: { listUnreadForUser: jest.fn(), listRecentForUser: jest.fn() },
}))

import { getGmailContextForUser, isGmailReauthorizationError, shouldConsultGmail, shouldIncludeGmailSignal } from '../gmail-context'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { gmailService } from '@/lib/google'

describe('Gmail chat context', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads the persisted Gmail grant and passes only minimal message metadata to the chat context', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listRecentForUser as jest.Mock).mockResolvedValue([
      { id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>', snippet: 'Private body text' },
    ])

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({
      status: 'available',
      messages: [{ id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>' }],
    })
    expect(gmailService.listRecentForUser).toHaveBeenCalledWith('user-1', 8)
  })

  it('reports a configured-but-temporarily-unavailable mailbox without claiming it is disconnected', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listRecentForUser as jest.Mock).mockRejectedValue(new Error('provider error'))

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({ status: 'unavailable', messages: [] })
  })

  it('reports when Google requires Gmail authorization again after an insufficient-scope response', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listRecentForUser as jest.Mock).mockRejectedValue({
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
