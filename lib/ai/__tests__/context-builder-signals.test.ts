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
jest.mock('@/lib/ai/gmail-context', () => ({
  ...jest.requireActual('@/lib/ai/gmail-context'),
  getGmailContextForUser: jest.fn(),
}))

import { buildUserContext } from '@/lib/ai/context-builder'
import { prisma } from '@/lib/prisma'
import { CalendarAggregator } from '@/lib/calendar-aggregator'
import { getActiveSignal } from '@/lib/cognitive/active-signal'
import { buildTwinContextSummary } from '@/lib/cognitive/twin-context'
import { getGmailContextForUser } from '@/lib/ai/gmail-context'

describe('buildUserContext provider signal bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
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
    ;(buildTwinContextSummary as jest.Mock).mockResolvedValue(null)
    ;(getGmailContextForUser as jest.Mock).mockResolvedValue({ status: 'available', messages: [] })
  })
  afterEach(() => jest.restoreAllMocks())

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

  it('includes Codex session summaries only when development or current-work context is authorized', async () => {
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([
      { source: 'codex', signalType: 'codex_task', label: 'Codex task · novo-web · Fix the Twin context bridge', observedAt: new Date('2026-10-14T10:00:00.000Z'), reliability: 'direct' },
    ])

    const denied = await buildUserContext('user-1', { contextAccess: { personal: false, integrations: false, development: false, currentWorkContext: false, deviceActivityRead: false } })
    expect(denied.structured.externalSignals).toEqual([])
    expect(prisma.novoSignalLedger.findMany).not.toHaveBeenCalled()

    const allowed = await buildUserContext('user-1', { contextAccess: { personal: false, integrations: false, development: false, currentWorkContext: true, deviceActivityRead: false } })
    expect(allowed.structured.externalSignals).toEqual([
      expect.objectContaining({ source: 'codex', signalType: 'codex_task', label: 'Codex task · novo-web · Fix the Twin context bridge' }),
    ])
    expect(allowed.structured.sources).toEqual(expect.arrayContaining([expect.objectContaining({ provider: 'codex' })]))

    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{ source: 'codex' }])
    const excluded = await buildUserContext('user-1', { contextAccess: { personal: false, integrations: false, development: false, currentWorkContext: true, deviceActivityRead: false } })
    expect(excluded.structured.externalSignals).toEqual([])
    expect(excluded.structured.sources).not.toEqual(expect.arrayContaining([expect.objectContaining({ provider: 'codex' })]))
  })

  it.each(['calendar', 'twin'])('keeps healthy task and provider context when %s fails', async (source) => {
    ;(prisma.task.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.task.findMany as jest.Mock).mockResolvedValue([{ id: 'task-1', title: 'Prepare demo' }])
    if (source === 'calendar') (CalendarAggregator.getEventsForRange as jest.Mock).mockRejectedValue(new Error('private provider diagnostic'))
    else (buildTwinContextSummary as jest.Mock).mockRejectedValue(new Error('private provider diagnostic'))

    const context = await buildUserContext('user-1', { twinMode: true })

    expect(context.structured.state.activeTasks).toBe(3)
    expect(context.structured.state.tasksList).toEqual([expect.objectContaining({ title: 'Prepare demo' })])
    expect(context.structured.externalSignals).toEqual([expect.objectContaining({ source: 'github' })])
    expect(context.structured.retrieval).toEqual({ status: 'partial', unavailable: [source === 'calendar' ? 'todaySchedule' : 'twinContext'] })
    expect(context.summary).not.toContain('private provider diagnostic')
    expect(CalendarAggregator.getEventsForRange).toHaveBeenCalledWith('user-1', expect.any(Date), expect.any(Date), expect.any(Array), expect.any(Function))
  })

  it('keeps unknown task counts distinct from a confirmed empty account', async () => {
    ;(prisma.task.count as jest.Mock).mockRejectedValue(new Error('private database diagnostic'))
    const context = await buildUserContext('user-1')
    expect(context.structured.state.activeTasks).toBeNull()
    expect(context.structured.state.overdueTasks).toBeNull()
    expect(context.structured.retrieval?.unavailable).toEqual(expect.arrayContaining(['state.activeTasks', 'state.overdueTasks']))
    expect(context.summary).toContain('unavailable')
    expect(context.summary).not.toContain('private database diagnostic')
  })

  it('does not turn a Gmail lookup outage into disconnected or reauthorization-required', async () => {
    ;(getGmailContextForUser as jest.Mock).mockRejectedValue(new Error('private oauth diagnostic'))
    const context = await buildUserContext('user-1', { includeGmail: true })
    expect(context.structured.mailbox).toEqual({ status: 'unavailable', messages: [] })
    expect(context.structured.retrieval?.unavailable).toContain('mailbox')
    expect(context.summary).not.toContain('private oauth diagnostic')
  })

  it('marks Gmail unavailable when its adapter resolves an operational failure', async () => {
    ;(getGmailContextForUser as jest.Mock).mockResolvedValue({ status: 'unavailable', messages: [] })
    const context = await buildUserContext('user-1', { includeGmail: true })
    expect(context.structured.retrieval).toEqual({ status: 'partial', unavailable: ['mailbox'] })
    expect(context.structured.mailbox?.status).toBe('unavailable')
  })

  it('fails closed before source reads when exclusions cannot be checked', async () => {
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockRejectedValue(new Error('private consent diagnostic'))
    const context = await buildUserContext('user-1', { includeGmail: true, twinMode: true })
    expect(prisma.task.findMany).not.toHaveBeenCalled()
    expect(prisma.novoSignalLedger.findMany).not.toHaveBeenCalled()
    expect(getGmailContextForUser).not.toHaveBeenCalled()
    expect(buildTwinContextSummary).not.toHaveBeenCalled()
    expect(context.structured.retrieval?.status).toBe('unavailable')
    expect(context.structured.state.activeTasks).toBeNull()
    expect(context.structured.sources).toEqual([])
    expect(context.summary).not.toContain('private consent diagnostic')
    expect(console.error).toHaveBeenCalledWith('[Context Builder] Context retrieval failed.')
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain('private consent diagnostic')
  })

  it('still represents successful empty reads as complete context with zero counts', async () => {
    const context = await buildUserContext('user-1')
    expect(context.structured.state.activeTasks).toBe(0)
    expect(context.structured.retrieval).toEqual({ status: 'complete', unavailable: [] })
  })

  it('bounds routine prefetch while keeping full counts and declaring the context window', async () => {
    ;(prisma.routine.count as jest.Mock).mockResolvedValue(60)
    const context = await buildUserContext('user-1')
    expect(prisma.routine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', isActive: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: expect.objectContaining({
        id: true, name: true, scheduledTime: true,
        days: expect.objectContaining({
          take: 7,
          select: expect.objectContaining({
            exercises: expect.objectContaining({ take: 12 }),
          }),
        }),
      }),
    }))
    expect(context.structured.state.activeRoutines).toBe(60)
    expect(context.structured.contextWindow).toEqual(expect.objectContaining({ routines: 10, routineDays: 7, exercisesPerDay: 12 }))
    expect(context.summary).toContain('contextWindow')
  })
})
