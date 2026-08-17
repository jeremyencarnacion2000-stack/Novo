import { processOneCognitiveReplanRequest } from '../process-replan-requests'

const state: any = {}
jest.mock('@/lib/prisma', () => ({ prisma: { cognitiveReplanRequest: { findFirst: jest.fn(), updateMany: jest.fn() }, actionPlan: { findFirst: jest.fn() } } }))
jest.mock('@/lib/ai/activity', () => ({ createActivityRun: jest.fn(), getActivityRun: jest.fn(), appendActivityEvent: jest.fn(), finishActivityRun: jest.fn() }))
jest.mock('@/lib/cognitive/canonical-planner', () => ({ planUserContext: jest.fn() }))
import { planUserContext } from '@/lib/cognitive/canonical-planner'
const mockPrisma: any = require('@/lib/prisma').prisma
const mockActivity: any = require('@/lib/ai/activity')

function setup(overrides: any = {}) {
  jest.clearAllMocks()
  const now = new Date('2026-08-11T12:00:00.000Z')
  state.request = { id: 'r1', userId: 'u1', completedTaskId: 'done', status: 'pending', nextAttemptAt: new Date(0), resultingActionPlanId: null, ...overrides }
  state.plan = { id: 'p1', userId: 'u1', status: 'active', actions: [{ taskId: 'next', title: 'Next' }] }
  mockPrisma.cognitiveReplanRequest.findFirst.mockResolvedValue(state.request)
  mockPrisma.cognitiveReplanRequest.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.actionPlan.findFirst.mockResolvedValue(state.plan)
  ;(planUserContext as jest.Mock).mockResolvedValue({ plan: { id: 'p1' } })
  mockActivity.createActivityRun.mockResolvedValue({ id: 'run1' })
  mockActivity.getActivityRun.mockResolvedValue({ run: { id: 'adaptation-r1' }, events: [] })
  mockActivity.appendActivityEvent.mockResolvedValue(undefined)
  mockActivity.finishActivityRun.mockResolvedValue(undefined)
  return now
}

describe('durable replan processor adversarial contract', () => {
  it('A: claims pending request, persists plan, emits ADAPTED and NEXT exactly once', async () => {
    const now = setup()
    const result = await processOneCognitiveReplanRequest(now)
    expect(result).toMatchObject({ processed: true, requestId: 'r1', actionPlanId: 'p1' })
    expect(mockActivity.appendActivityEvent).toHaveBeenCalledTimes(2)
    expect(mockActivity.finishActivityRun).toHaveBeenCalledTimes(1)
    expect(mockPrisma.cognitiveReplanRequest.updateMany).toHaveBeenCalledTimes(2)
  })

  it('B: reuses an existing persisted plan and does not invoke planner/P3', async () => {
    const now = setup({ resultingActionPlanId: 'p1' })
    await processOneCognitiveReplanRequest(now)
    expect(planUserContext).not.toHaveBeenCalled()
    expect(mockActivity.createActivityRun).not.toHaveBeenCalled()
  })

  it('C: converges after Activity create race and keeps ADAPTED/NEXT idempotent', async () => {
    const now = setup()
    mockActivity.getActivityRun.mockResolvedValueOnce(null).mockResolvedValue({ run: { id: 'adaptation-r1' }, events: [{ label: 'ADAPTED' }, { label: 'NEXT' }] })
    mockActivity.createActivityRun.mockRejectedValueOnce(new Error('unique race'))
    await processOneCognitiveReplanRequest(now)
    expect(mockActivity.appendActivityEvent).not.toHaveBeenCalled()
  })

  it('D: refuses a plan that still recommends the completed task', async () => {
    const now = setup()
    mockPrisma.actionPlan.findFirst.mockResolvedValue({ ...state.plan, actions: [{ taskId: 'done', title: 'Stale' }] })
    const result = await processOneCognitiveReplanRequest(now)
    expect(result).toMatchObject({ processed: true, failed: true })
    expect(mockPrisma.cognitiveReplanRequest.updateMany).toHaveBeenCalledTimes(2)
  })

  it('E: returns raced when atomic claim loses', async () => {
    const now = setup()
    mockPrisma.cognitiveReplanRequest.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(processOneCognitiveReplanRequest(now)).resolves.toMatchObject({ processed: false, raced: true })
    expect(planUserContext).not.toHaveBeenCalled()
  })

  it('F: stale worker token cannot finalize a request and does not report success', async () => {
    const now = setup()
    mockPrisma.cognitiveReplanRequest.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 })
    await expect(processOneCognitiveReplanRequest(now)).resolves.toMatchObject({ processed: false, leaseLost: true, requestId: 'r1' })
  })
})
