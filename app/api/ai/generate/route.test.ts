/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

describe('POST /api/ai/generate safe failures', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not expose a malformed request or internal parser detail', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const response = await POST(new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ private parser detail',
    }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'InternalError', message: 'No se pudo completar la solicitud de IA.' })
    expect(JSON.stringify(body)).not.toContain('private parser detail')
  })
})
