/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationAccount: { findFirst: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createTodoistAmbientPrismaPorts } from '../todoist-ambient-prisma-adapter'

describe('Todoist ambient Prisma connection eligibility', () => {
  it('loads an identified legacy connection whose syncStatus is null', async () => {
    ;(prisma.integrationAccount.findFirst as jest.Mock).mockResolvedValue({
      id: 'connection-1',
      userId: 'user-1',
      provider: 'todoist',
      providerAccountId: 'todoist-user-1',
      accessToken: 'protected-token',
      syncStatus: null,
    })
    const ports = createTodoistAmbientPrismaPorts({
      discoverCandidates: jest.fn(),
      verifyTask: jest.fn(),
    })

    await expect(ports.loadConnection('connection-1')).resolves.toMatchObject({
      id: 'connection-1',
      providerAccountId: 'todoist-user-1',
      status: null,
    })
    expect(prisma.integrationAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ syncStatus: null }, { syncStatus: { notIn: expect.arrayContaining(['revoked', 'disconnected']) } }],
      }),
    }))
  })
})
