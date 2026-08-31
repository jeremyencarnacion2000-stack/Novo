/** @jest-environment node */

jest.mock('@/lib/plugins/plugin-orchestrator', () => ({ syncAllPlugins: jest.fn() }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn() },
    userSettings: { findUnique: jest.fn() },
    ambientReconciliationClaim: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    novoSignalLedger: { upsert: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { syncAllPlugins } from '@/lib/plugins/plugin-orchestrator'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'
import {
  maybeRefreshAmbientContextForUser,
  refreshAmbientContextForAllUsers,
  refreshAmbientContextForUser,
} from '../ambient-context-refresh'

describe('ambient context refresh scheduling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(syncAllPlugins as jest.Mock).mockResolvedValue({ results: [], totalSignals: 0, twinUpdated: false })
    ;(runAmbientTwinForUser as jest.Mock).mockResolvedValue({ status: 'active' })
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.ambientReconciliationClaim.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.ambientReconciliationClaim.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.ambientReconciliationClaim.create as jest.Mock).mockImplementation(async () => ({
      id: `claim-${Math.random()}`,
      claimedAt: new Date(),
    }))
    ;(prisma.novoSignalLedger.upsert as jest.Mock).mockResolvedValue({})
  })

  it('prioritizes never-attempted Twins and then the oldest durable attempt', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'never-attempted' }])
    ;(prisma.ambientReconciliationClaim.findMany as jest.Mock).mockResolvedValue([{ userId: 'oldest-attempted' }])

    await expect(refreshAmbientContextForAllUsers(2)).resolves.toEqual({
      processed: 2,
      succeeded: 2,
      skipped: 0,
      failed: 0,
    })

    expect(syncAllPlugins).toHaveBeenCalledTimes(2)
    expect(syncAllPlugins).toHaveBeenCalledWith('never-attempted')
    expect(syncAllPlugins).toHaveBeenCalledWith('oldest-attempted')
    expect(prisma.novoSignalLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ sourceRef: 'background' }),
    }))
  })

  it('lets only one concurrent request poll providers for the same user', async () => {
    const claimedAt = new Date('2026-08-27T10:00:00.000Z')
    let finishSync!: () => void
    ;(syncAllPlugins as jest.Mock).mockImplementation(() => new Promise((resolve) => {
      finishSync = () => resolve({ results: [], totalSignals: 0, twinUpdated: false })
    }))
    ;(prisma.ambientReconciliationClaim.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'claim-1', claimedAt })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'P2002' }))

    const first = refreshAmbientContextForUser('user-1', 'interactive')
    await Promise.resolve()
    const second = refreshAmbientContextForUser('user-1', 'interactive')
    await expect(second).resolves.toMatchObject({ status: 'skipped', reason: 'recent_or_processing' })
    expect(syncAllPlugins).toHaveBeenCalledTimes(1)

    finishSync()
    await expect(first).resolves.toMatchObject({ status: 'refreshed' })
    expect(prisma.ambientReconciliationClaim.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'claim-1', claimedAt }),
    }))
  })

  it('uses the durable claim timestamp as the interactive throttle', async () => {
    ;(prisma.ambientReconciliationClaim.findUnique as jest.Mock).mockResolvedValue({
      id: 'claim-1',
      status: 'completed',
      claimedAt: new Date(),
      claimExpiresAt: null,
    })

    await expect(maybeRefreshAmbientContextForUser('user-1')).resolves.toEqual({
      refreshed: false,
      reason: 'recent_or_processing',
    })
    expect(syncAllPlugins).not.toHaveBeenCalled()
  })

  it('records a bounded attempt but performs no provider read while learning is paused', async () => {
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({
      settings: { cognitiveLearningPaused: true },
    })

    await expect(refreshAmbientContextForUser('user-1')).resolves.toEqual({
      status: 'skipped',
      reason: 'paused',
    })
    expect(syncAllPlugins).not.toHaveBeenCalled()
    expect(prisma.ambientReconciliationClaim.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }),
    }))
  })

  it('starts later users without waiting for a slow first worker', async () => {
    const userIds = Array.from({ length: 6 }, (_, index) => ({ id: `user-${index + 1}` }))
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue(userIds)
    ;(prisma.ambientReconciliationClaim.findMany as jest.Mock).mockResolvedValue([])
    let finishFirst!: () => void
    ;(syncAllPlugins as jest.Mock).mockImplementation((userId: string) => {
      if (userId !== 'user-1') return Promise.resolve({ results: [], totalSignals: 0, twinUpdated: false })
      return new Promise((resolve) => {
        finishFirst = () => resolve({ results: [], totalSignals: 0, twinUpdated: false })
      })
    })

    const refresh = refreshAmbientContextForAllUsers(6)
    for (let tick = 0; tick < 20; tick += 1) await Promise.resolve()
    expect(syncAllPlugins).toHaveBeenCalledWith('user-6')

    finishFirst()
    await expect(refresh).resolves.toMatchObject({ processed: 6, succeeded: 6, failed: 0 })
  })
})
