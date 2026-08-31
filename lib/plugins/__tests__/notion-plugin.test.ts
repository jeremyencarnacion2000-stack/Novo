/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({ prisma: {
  integrationAccount: { findUnique: jest.fn() },
  cognitiveTwinRecord: { update: jest.fn() },
  checklistItem: { findFirst: jest.fn(), create: jest.fn() },
} }))
jest.mock('@/lib/cognitive/get-or-create-twin', () => ({ getOrCreateTwin: jest.fn() }))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { syncNotionPlugin } from '../notion-plugin'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, text: async () => '', json: async () => body } as Response
}

describe('Notion ambient plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOrCreateTwin as jest.Mock).mockResolvedValue({ id: 'twin-1', energyCurve: {} })
    ;(prisma.checklistItem.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.checklistItem.create as jest.Mock).mockResolvedValue({})
    ;(prisma.cognitiveTwinRecord.update as jest.Mock).mockResolvedValue({})
  })

  it('never falls back to workspace-wide search without selected databases', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { databaseIds: [] },
    })
    global.fetch = jest.fn() as jest.Mock

    await expect(syncNotionPlugin('user-1')).resolves.toMatchObject({
      error: 'scope_not_selected', pagesRead: 0,
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('reads only selected databases and persists an aggregate observation', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'token', metadata: { databaseIds: ['db-1', 'db-2'] },
    })
    global.fetch = jest.fn(async (input: string | URL | Request) => response({ results: [{
      id: `page-${String(input).includes('db-1') ? '1' : '2'}`,
      properties: { Name: { type: 'title', title: [{ plain_text: 'Authorized task' }] } },
      created_time: '2026-08-01T10:00:00.000Z',
      last_edited_time: '2026-08-27T10:00:00.000Z',
      url: 'https://notion.so/example',
      archived: false,
    }] })) as jest.Mock

    await expect(syncNotionPlugin('user-1')).resolves.toMatchObject({ pagesRead: 2, signalsEmitted: 1 })
    const urls = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input))
    expect(urls).toEqual(expect.arrayContaining([
      'https://api.notion.com/v1/databases/db-1/query',
      'https://api.notion.com/v1/databases/db-2/query',
    ]))
    expect(urls.some((url) => url.endsWith('/search'))).toBe(false)
    expect(upsertNovoSignals).toHaveBeenCalledWith('user-1', [expect.objectContaining({
      source: 'notion', sourceRef: 'selected-databases', signalType: 'task_state_observed',
    })])
  })
})
