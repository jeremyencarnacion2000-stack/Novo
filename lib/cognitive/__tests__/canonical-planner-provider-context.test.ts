/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    goal: { findFirst: jest.fn() },
    cognitiveStateSnapshot: { findFirst: jest.fn() },
    task: { findMany: jest.fn() },
    outcomeEvent: { findMany: jest.fn() },
    recommendedAction: { findMany: jest.fn() },
    novoSignalLedger: { findMany: jest.fn() },
    novoSignalSourcePreference: { findMany: jest.fn() },
    cognitiveTwinRecord: { findUnique: jest.fn() },
    actionPlan: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/cognitive/decision-rules', () => ({ choosePrimaryRecommendation: jest.fn() }))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))
jest.mock('@/lib/cognitive/twin-adaptation', () => ({ parsePersistedTwinAdaptationProposals: jest.fn().mockReturnValue([]) }))
jest.mock('@/lib/ai/activity', () => ({
  createActivityRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
  getActivityRun: jest.fn(),
  appendActivityEvent: jest.fn(),
  finishActivityRun: jest.fn(),
}))

import { planUserContext } from '@/lib/cognitive/canonical-planner'
import { prisma } from '@/lib/prisma'
import { choosePrimaryRecommendation } from '@/lib/cognitive/decision-rules'

describe('canonical planner provider context bridge', () => {
  let actionPlanCreateData: any

  beforeEach(() => {
    jest.clearAllMocks()
    actionPlanCreateData = null
    ;(prisma.goal.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.cognitiveStateSnapshot.findFirst as jest.Mock).mockResolvedValue({ id: 'snapshot-1', energy: 3, focus: 4, workload: 2, availableMinutes: 30, createdAt: new Date() })
    ;(prisma.task.findMany as jest.Mock).mockResolvedValue([{ id: 'task-1', title: 'Ship release', priority: 'high', dueDate: null, updatedAt: new Date(), status: 'todo' }])
    ;(prisma.outcomeEvent.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.recommendedAction.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([
      { source: 'github', sourceRef: 'activity-window', signalType: 'activity_window', label: 'GitHub observed: 7 commits in 14 days', observedAt: new Date(), reliability: 'deterministic', excludedAt: null, correction: null },
      { source: 'slack', sourceRef: 'activity-window', signalType: 'activity_window', label: 'Slack activity observed', observedAt: new Date(), reliability: 'deterministic', excludedAt: null, correction: null },
      { source: 'gmail', sourceRef: 'inbox', signalType: 'unread_observed', label: 'Gmail inbox observed: 9 unread messages', observedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), reliability: 'direct', excludedAt: null, correction: null },
    ])
    ;(prisma.novoSignalSourcePreference.findMany as jest.Mock).mockResolvedValue([{ source: 'slack' }])
    ;(prisma.cognitiveTwinRecord.findUnique as jest.Mock).mockResolvedValue(null)
    ;(choosePrimaryRecommendation as jest.Mock).mockReturnValue({ taskId: 'task-1', title: 'Ship release', nextStep: 'Run release checks', estimatedMinutes: 30, confidence: 0.8, facts: ['High priority.'], inferences: ['Ready.'], explanation: 'High priority.', score: 30 })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback({
      task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1' }) },
      actionPlan: {
        updateMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => {
          actionPlanCreateData = data
          return { id: 'plan-1', ...data, actions: [] }
        }),
      },
    }))
  })

  it('persists only authorized provider summaries as explainable planning evidence', async () => {
    const result = await planUserContext({ userId: 'user-1', timezone: 'UTC' })
    const createdPlan = result.plan as any

    expect(createdPlan.inputs.providerSignalSources).toEqual(['github'])
    expect(createdPlan.inputs.providerSignalCount).toBe(1)
    expect(actionPlanCreateData.actions.create.facts).toContain('GitHub observed: 7 commits in 14 days')
    expect(actionPlanCreateData.actions.create.facts).not.toContain('Slack activity observed')
    expect(actionPlanCreateData.actions.create.facts).not.toContain('Gmail inbox observed: 9 unread messages')
  })

  it('replays the plan recorded on a completed activity run', async () => {
    const replayPlan = { id: 'plan-replay', userId: 'user-1', actions: [], goal: null }
    const activity = require('@/lib/ai/activity')
    ;(activity.getActivityRun as jest.Mock).mockResolvedValue({
      run: { id: 'run-1', status: 'completed', resultRef: replayPlan.id },
      events: [],
    })
    ;(prisma.actionPlan.findFirst as jest.Mock).mockResolvedValue(replayPlan)

    const result = await planUserContext({ userId: 'user-1', timezone: 'UTC', runId: 'run-1' })

    expect(result).toEqual({ plan: replayPlan, runId: 'run-1' })
    expect(activity.appendActivityEvent).not.toHaveBeenCalled()
    expect(prisma.actionPlan.updateMany).not.toHaveBeenCalled()
    expect(prisma.actionPlan.create).not.toHaveBeenCalled()
  })
})
