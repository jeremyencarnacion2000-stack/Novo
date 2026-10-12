/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: { findUnique: jest.fn() },
    userCognitiveSnapshot: { findUnique: jest.fn() },
    task: { count: jest.fn(), findMany: jest.fn() },
    routine: { count: jest.fn(), findMany: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    checklistItem: { findMany: jest.fn() },
    integrationAccount: { findMany: jest.fn() },
    actionPlan: { findFirst: jest.fn() },
    outcomeEvent: { findMany: jest.fn() },
    novoSignalLedger: { findMany: jest.fn() },
    novoSignalSourcePreference: { findMany: jest.fn() },
    companionWorkContext: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/calendar-aggregator', () => ({ CalendarAggregator: { getEventsForRange: jest.fn() } }))
jest.mock('@/lib/cognitive/active-signal', () => ({ getActiveSignal: jest.fn() }))
jest.mock('@/lib/cognitive/twin-context', () => ({ buildTwinContextSummary: jest.fn() }))
jest.mock('@/lib/ai/gmail-context', () => ({ getGmailContextForUser: jest.fn() }))

import { buildUserContext } from '@/lib/ai/context-builder'
import { prisma } from '@/lib/prisma'
import { CalendarAggregator } from '@/lib/calendar-aggregator'
import { getActiveSignal } from '@/lib/cognitive/active-signal'

describe('buildUserContext provider signal bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.userSettings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.userCognitiveSnapshot.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.task.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.task.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.routine.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.routine.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.project.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.integrationAccount.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.actionPlan.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.outcomeEvent.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.companionWorkContext.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{ source: 'slack' }])
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([
      { source: 'github', signalType: 'activity_window', label: 'GitHub observed: 7 commits in 14 days', observedAt: new Date('2026-08-27T10:00:00.000Z'), reliability: 'deterministic' },
      { source: 'slack', signalType: 'activity_window', label: 'Slack activity observed: 12 messages in 48h', observedAt: new Date('2026-08-27T10:00:00.000Z'), reliability: 'deterministic' },
    ])
    ;(CalendarAggregator.getEventsForRange as jest.Mock).mockResolvedValue([])
    ;(getActiveSignal as jest.Mock).mockResolvedValue(null)
  })

  it('places authorized aggregate provider signals in chat context and omits excluded sources', async () => {
    const context = await buildUserContext('user-1')

    expect(context.structured.externalSignals).toEqual([
      expect.objectContaining({ source: 'github', signalType: 'activity_window', label: 'GitHub observed: 7 commits in 14 days' }),
    ])
    expect(context.structured.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'novo' }),
      expect.objectContaining({ provider: 'github' }),
    ]))
    expect(context.structured.sources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'slack' }),
    ]))
    expect(context.summary).toContain('GitHub observed: 7 commits in 14 days')
    expect(context.summary).not.toContain('Slack activity observed')
  })

  it('does not present a revoked provider as active Twin context', async () => {
    ;(prisma.integrationAccount.findMany as jest.Mock).mockResolvedValue([
      { provider: 'github', syncStatus: 'reauth_required', lastSuccessfulSyncAt: null },
      { provider: 'notion', syncStatus: 'connected', lastSuccessfulSyncAt: new Date('2026-08-28T10:00:00.000Z') },
    ])

    const context = await buildUserContext('user-1')

    expect(context.structured.activePlugins).toEqual(['notion'])
    expect(context.structured.providerHealth).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'github', status: 'reauth_required', lastSuccessfulSyncAt: null }),
      expect.objectContaining({ provider: 'notion', status: 'connected' }),
    ]))
  })
})
