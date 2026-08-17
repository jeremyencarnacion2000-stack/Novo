/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/google', () => ({ getGoogleAccessToken: jest.fn() }))
jest.mock('@/lib/db-biometrics', () => ({ fetchDbBiometricPayload: jest.fn() }))
jest.mock('@/lib/google-fit', () => ({ fetchBiometricPayload: jest.fn() }))

import { getServerSession } from 'next-auth'
import { getGoogleAccessToken } from '@/lib/google'
import { fetchDbBiometricPayload } from '@/lib/db-biometrics'
import { GET } from './route'

describe('GET /api/cognitive/biometrics', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not return a fabricated stress value when the fallback fails', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, provider: 'credentials' })
    ;(fetchDbBiometricPayload as jest.Mock).mockRejectedValue(new Error('private database detail'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'InternalError', message: 'Biometric data is temporarily unavailable.', hasGoogleFitData: false })
    expect(JSON.stringify(body)).not.toContain('private database detail')
    expect(getGoogleAccessToken).not.toHaveBeenCalled()
  })
})
