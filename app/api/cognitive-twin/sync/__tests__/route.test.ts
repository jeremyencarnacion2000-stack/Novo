jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cognitiveTwinRecord: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from '../route'

describe('Cognitive Twin sync validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects unknown top-level fields before touching Prisma', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: {}, unsupportedMutation: true }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    expect(prisma.cognitiveTwinRecord.findUnique).not.toHaveBeenCalled()
    expect(prisma.cognitiveTwinRecord.update).not.toHaveBeenCalled()
    expect(prisma.cognitiveTwinRecord.create).not.toHaveBeenCalled()
  })

  it('backfills onboarding completion for an initialized legacy Twin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue({
      id: 'twin-1',
      userId: 'user-1',
      isInitialized: true,
      onboardingCompletedAt: null,
    })
    ;(prisma.cognitiveTwinRecord.update as jest.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'twin-1',
        userId: 'user-1',
        isInitialized: true,
        onboardingCompletedAt: data.onboardingCompletedAt ?? null,
      }),
    )
    const request = new Request('http://localhost/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isInitialized: true }),
    })

    const response = await POST(request as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.twin.onboardingCompletedAt).not.toBeNull()
  })
})
