/** @jest-environment node */

jest.mock('@/lib/google-account', () => ({
  findGoogleAccountForScopes: jest.fn(),
}))
jest.mock('@/lib/google', () => ({
  gmailService: { listUnreadForUser: jest.fn() },
}))

import { getGmailContextForUser, shouldConsultGmail } from '../gmail-context'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { gmailService } from '@/lib/google'

describe('Gmail chat context', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads the persisted Gmail grant and passes only minimal message metadata to the chat context', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listUnreadForUser as jest.Mock).mockResolvedValue([
      { id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>', snippet: 'Private body text' },
    ])

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({
      status: 'available',
      messages: [{ id: 'mail-1', subject: 'Deploy review', from: 'Team <team@example.test>' }],
    })
    expect(gmailService.listUnreadForUser).toHaveBeenCalledWith('user-1', 8)
  })

  it('reports a configured-but-temporarily-unavailable mailbox without claiming it is disconnected', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listUnreadForUser as jest.Mock).mockRejectedValue(new Error('provider error'))

    await expect(getGmailContextForUser('user-1')).resolves.toEqual({ status: 'unavailable', messages: [] })
  })

  it('reports when Google requires Gmail authorization again after an insufficient-scope response', async () => {
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.listUnreadForUser as jest.Mock).mockRejectedValue({
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
})
