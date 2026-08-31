/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({ prisma: {
  integrationAccount: { findUnique: jest.fn(), updateMany: jest.fn() },
  cognitiveTwinRecord: { update: jest.fn() },
} }))
jest.mock('@/lib/cognitive/get-or-create-twin', () => ({ getOrCreateTwin: jest.fn() }))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { syncSlackPlugin } from '../slack-plugin'
import { syncGitHubPlugin } from '../github-plugin'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

describe('provider poll snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.cognitiveTwinRecord.update as jest.Mock).mockResolvedValue({})
    ;(prisma.integrationAccount.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('keeps repeated Slack windows idempotent instead of incrementing Twin metrics', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({ accessToken: 'slack-token' })
    ;(getOrCreateTwin as jest.Mock).mockResolvedValue({
      id: 'twin-1', metrics: { burnoutIndex: 10, currentCognitiveLoad: 20 },
    })
    const afterHours = new Date(); afterHours.setHours(2, 0, 0, 0)
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('auth.test')) return response({ ok: true, user_id: 'slack-user' })
      if (url.includes('conversations.list')) return response({ ok: true, channels: [{ id: 'c1', name: 'team', is_member: true }] })
      return response({ ok: true, messages: [{
        ts: String(afterHours.getTime() / 1000), text: 'not persisted', user: 'slack-user', type: 'message',
      }] })
    }) as jest.Mock

    await syncSlackPlugin('user-1')
    await syncSlackPlugin('user-1')

    expect(upsertNovoSignals).toHaveBeenCalledTimes(2)
    expect(upsertNovoSignals).toHaveBeenLastCalledWith('user-1', [expect.objectContaining({
      source: 'slack', sourceRef: 'activity-window', signalType: 'activity_observed',
    })])
    const updates = (prisma.cognitiveTwinRecord.update as jest.Mock).mock.calls
    expect(updates).toHaveLength(2)
    expect(updates[0][0].data.metrics).toEqual(updates[1][0].data.metrics)
    expect(JSON.stringify((upsertNovoSignals as jest.Mock).mock.calls)).not.toContain('not persisted')
  })

  it('keeps repeated GitHub windows idempotent and stores aggregates only', async () => {
    ;(prisma.integrationAccount.findUnique as jest.Mock).mockResolvedValue({ accessToken: 'github-token' })
    ;(getOrCreateTwin as jest.Mock).mockResolvedValue({
      id: 'twin-1', metrics: { burnoutIndex: 5 }, energyCurve: {},
    })
    const commits = Array.from({ length: 5 }, (_, index) => ({
      sha: `sha-${index}`,
      author: { login: 'novo-user' },
      commit: { author: { name: 'Angel', email: 'noreply@users.noreply.github.com', date: '2026-08-24T05:00:00.000Z' }, message: 'private commit message' },
    }))
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/user')) return response({ id: 42, email: null, login: 'novo-user' })
      if (url.includes('/user/repos')) return response([{ full_name: 'qa/repo', pushed_at: '', private: true }])
      return response(commits)
    }) as jest.Mock

    const first = await syncGitHubPlugin('user-1')
    await syncGitHubPlugin('user-1')

    expect(upsertNovoSignals).toHaveBeenCalledTimes(2)
    expect(first).toMatchObject({ commitsAnalyzed: 5, lateNightCommits: 5 })
    expect(upsertNovoSignals).toHaveBeenLastCalledWith('user-1', [expect.objectContaining({
      source: 'github', sourceRef: 'coding-window', signalType: 'coding_activity_observed',
    })])
    const metricUpdates = (prisma.cognitiveTwinRecord.update as jest.Mock).mock.calls
      .map(([call]) => call.data.metrics)
      .filter(Boolean)
    expect(metricUpdates[0]).toEqual(metricUpdates[1])
    expect(JSON.stringify((upsertNovoSignals as jest.Mock).mock.calls)).not.toContain('private commit message')
  })
})
