/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationAccount: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))
jest.mock('@/lib/plugins/plugin-orchestrator', () => ({ syncPlugin: jest.fn() }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET, DELETE } from './route'

describe('GitHub integration status route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('returns aggregate status without exposing the provider token', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'github-secret-token',
      providerAccountId: '42',
      metadata: { login: 'angel', repoCount: 4 },
      syncStatus: 'connected',
      lastSyncedAt: new Date('2026-08-28T10:00:00.000Z'),
      lastSuccessfulSyncAt: new Date('2026-08-28T10:00:00.000Z'),
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
      updatedAt: new Date('2026-08-28T10:00:00.000Z'),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ connected: true, login: 'angel', repoCount: 4, syncStatus: 'connected' })
    expect(JSON.stringify(body)).not.toContain('github-secret-token')
  })

  it('disconnects only the authenticated user GitHub account', async () => {
    ;(prisma.integrationAccount.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    const response = await DELETE()

    expect(response.status).toBe(200)
    expect(prisma.integrationAccount.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', provider: 'github' } })
  })
})
