/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({ prisma: {
  integrationAccount: { findUnique: jest.fn() },
  cognitiveTwinRecord: { update: jest.fn() },
  checklistItem: { findMany: jest.fn(), createMany: jest.fn(), updateMany: jest.fn() },
} }))
jest.mock('@/lib/cognitive/get-or-create-twin', () => ({ getOrCreateTwin: jest.fn() }))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { syncTodoistPlugin } from '../todoist-plugin'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('Todoist ambient plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOrCreateTwin as jest.Mock).mockResolvedValue({ id: 'twin-1', energyCurve: {} })
    ;(prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.checklistItem.createMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.checklistItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.cognitiveTwinRecord.update as jest.Mock).mockResolvedValue({})
  })

  it('fails closed without an explicitly selected project scope', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { projectIds: [] },
    })
    global.fetch = jest.fn() as jest.Mock

    await expect(syncTodoistPlugin('user-1')).resolves.toMatchObject({
      error: 'scope_not_selected', signalsEmitted: 0,
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('uses API v1 only within selected projects and stores idempotent aggregates', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { projectIds: ['project-1'] },
    })
    const today = new Date().toISOString()
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/tasks')) {
        return response({
          results: [{
            id: 'task-1', content: 'Selected task', priority: 4,
            project_id: 'project-1', due: { date: '2020-01-01' },
          }],
          next_cursor: null,
        })
      }
      return response({
        results: [{
          id: 'event-1', object_type: 'item', event_type: 'completed',
          event_date: today, parent_project_id: 'project-1',
        }],
        next_cursor: null,
      })
    }) as jest.Mock

    await expect(syncTodoistPlugin('user-1')).resolves.toMatchObject({
      tasksRead: 1, overdueTasks: 1, completedToday: 1, signalsEmitted: 2,
    })
    const urls = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input))
    expect(urls.every((url) => url.includes('/api/v1/') && url.includes('project-1'))).toBe(true)
    expect(upsertNovoSignals).toHaveBeenCalledWith('user-1', expect.arrayContaining([
      expect.objectContaining({ source: 'todoist', sourceRef: 'selected-projects' }),
      expect.objectContaining({ source: 'todoist', sourceRef: 'completion-window' }),
    ]))
    expect(prisma.checklistItem.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ sourceId: 'task-1', text: 'Selected task' })],
    }))
  })

  it('rejects a provider row that escapes the selected project lane', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { projectIds: ['project-1'] },
    })
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/tasks')
        ? response({ results: [{ id: 'task-x', content: 'Wrong task', project_id: 'project-2' }], next_cursor: null })
        : response({ results: [], next_cursor: null })
    }) as jest.Mock

    await expect(syncTodoistPlugin('user-1')).resolves.toMatchObject({ error: 'unavailable' })
    expect(upsertNovoSignals).not.toHaveBeenCalled()
    expect(prisma.checklistItem.createMany).not.toHaveBeenCalled()
  })

  it('refreshes an existing overdue row instead of keeping stale provider data', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { projectIds: ['project-1'] },
    })
    ;(prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([{ id: 'local-1', sourceId: 'task-1' }])
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return url.pathname.endsWith('/tasks')
        ? response({ results: [{ id: 'task-1', content: 'Renamed task', priority: 1, project_id: 'project-1', due: { date: '2020-01-01' } }], next_cursor: null })
        : response({ results: [], next_cursor: null })
    }) as jest.Mock

    await expect(syncTodoistPlugin('user-1')).resolves.toMatchObject({ overdueTasks: 1 })
    expect(prisma.checklistItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', source: 'todoist', sourceId: 'task-1' },
      data: expect.objectContaining({ text: 'Renamed task', completed: false, priority: 'low' }),
    }))
    expect(prisma.checklistItem.createMany).not.toHaveBeenCalled()
  })
})
