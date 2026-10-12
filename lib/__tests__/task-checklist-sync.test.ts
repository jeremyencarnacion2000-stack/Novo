/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    checklistItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/provider-sync-lock', () => ({
  withProviderSyncLock: jest.fn(async (_db: unknown, _key: string, work: (db: unknown) => Promise<unknown>) => {
    const { prisma } = require('@/lib/prisma')
    return work(prisma)
  }),
}))

import { prisma } from '@/lib/prisma'
import { syncTaskChecklist } from '../task-checklist-sync'

describe('task checklist mirror', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates the existing generated row instead of creating a duplicate', async () => {
    ;(prisma.checklistItem.findFirst as jest.Mock).mockResolvedValue({ id: 'check-1' })
    // Task due dates are calendar dates entered in the user's local timezone;
    // deriving the fixture from ISO/UTC makes this test fail around midnight
    // when UTC and the local calendar day differ.
    const now = new Date()
    const dueDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')

    await syncTaskChecklist({
      userId: 'user-1', taskId: 'task-1', title: 'Revised task', priority: 'high',
      status: 'done', dueDate,
    })

    expect(prisma.checklistItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'check-1' },
      data: { text: 'Revised task', priority: 'high', completed: true },
    }))
    expect(prisma.checklistItem.create).not.toHaveBeenCalled()
  })

  it('removes a stale generated row when a task leaves today', async () => {
    ;(prisma.checklistItem.findFirst as jest.Mock).mockResolvedValue({ id: 'check-1' })

    await syncTaskChecklist({
      userId: 'user-1', taskId: 'task-1', title: 'Tomorrow', priority: 'medium',
      status: 'todo', dueDate: null,
    })

    expect(prisma.checklistItem.delete).toHaveBeenCalledWith({ where: { id: 'check-1' } })
    expect(prisma.checklistItem.create).not.toHaveBeenCalled()
  })
})
