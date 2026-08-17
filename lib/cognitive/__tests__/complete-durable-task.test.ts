import { resolveCurrentRecommendedActionsForTask, runCanonicalReplanWithRetry } from '../complete-durable-task'
describe('durable work bridge contract', () => {
  it('exports a resolver for active task-backed recommendations', () => expect(resolveCurrentRecommendedActionsForTask).toBeDefined())

  it('crosses the canonical planner boundary and excludes completed work', async () => {
    const tasks = [{ id: 'task-a', status: 'done' }, { id: 'task-b', status: 'todo' }]
    const result = await runCanonicalReplanWithRetry({ userId: 'user-1', completedTaskId: 'task-a' }, async ({ completedTaskId }) => {
      const next = tasks.find((task) => task.id !== completedTaskId && task.status !== 'done')
      return { planId: 'plan-next', recommendationTaskId: next?.id }
    })
    expect(result.replanPending).toBe(false)
    expect(result.plan?.recommendationTaskId).toBe('task-b')
  })

  it('keeps replanPending truthful when the canonical planner is unavailable', async () => {
    const result = await runCanonicalReplanWithRetry({ userId: 'user-1', completedTaskId: 'task-a' }, async () => { throw new Error('planner_unavailable') }, 2)
    expect(result).toMatchObject({ replanPending: true, replanAttempts: 2, replanError: 'planner_unavailable' })
  })
})
