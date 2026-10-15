/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/google-account', () => ({ findGoogleAccountForScopes: jest.fn() }))
jest.mock('@/lib/google', () => ({ gmailService: { checkAccessForUser: jest.fn(), listUnreadForUser: jest.fn() } }))
jest.mock('@/lib/ai/gmail-context', () => ({ isGmailReauthorizationError: jest.fn() }))

import { getServerSession } from 'next-auth'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { gmailService } from '@/lib/google'
import { isGmailReauthorizationError } from '@/lib/ai/gmail-context'
import { GET } from './route'

describe('Gmail connection status', () => {
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'gmail-grant' })
    ;(gmailService.checkAccessForUser as jest.Mock).mockResolvedValue(undefined)
    ;(isGmailReauthorizationError as jest.Mock).mockReturnValue(false)
  })

  afterEach(() => consoleError.mockRestore())

  it('checks the provider grant before reporting Gmail as connected', async () => {
    const response = await GET()

    expect(await response.json()).toEqual({ connected: true, hasScope: true, state: 'connected' })
    expect(gmailService.checkAccessForUser).toHaveBeenCalledWith('user-1')
  })

  it('reports a stored but rejected grant as needing reauthorization', async () => {
    ;(gmailService.checkAccessForUser as jest.Mock).mockRejectedValue(new Error('provider rejected token'))
    ;(isGmailReauthorizationError as jest.Mock).mockReturnValue(true)

    const response = await GET()

    expect(await response.json()).toEqual({ connected: true, hasScope: true, state: 'reauthorization_required' })
  })

  it('keeps temporary provider failures separate from reauthorization', async () => {
    ;(gmailService.checkAccessForUser as jest.Mock).mockRejectedValue(new Error('provider unavailable'))

    const response = await GET()

    expect(await response.json()).toEqual({ connected: true, hasScope: true, state: 'unavailable' })
  })
})
