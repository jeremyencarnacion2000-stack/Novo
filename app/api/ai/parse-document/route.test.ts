/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { POST } from './route'

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

describe('POST /api/ai/parse-document', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requires an authenticated user before reading the upload', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const request = { formData: jest.fn() } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(request.formData).not.toHaveBeenCalled()
  })

  it('rejects oversized uploads before buffering or parsing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const file = {
      name: 'large.txt',
      size: MAX_DOCUMENT_BYTES + 1,
      arrayBuffer: jest.fn(),
    }
    const formData = { get: jest.fn().mockReturnValue(file) }
    const request = { formData: jest.fn().mockResolvedValue(formData) } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(413)
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('returns a stable validation error when no file is supplied', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const request = { formData: jest.fn().mockResolvedValue({ get: () => null }) } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No file provided' })
  })

  it('rejects malformed multipart fields instead of throwing while parsing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })
    const request = { formData: jest.fn().mockResolvedValue({ get: () => 'not-a-file' }) } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No file provided' })
  })
})
