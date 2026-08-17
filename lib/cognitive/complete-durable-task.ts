import { prisma } from '@/lib/prisma'
import { appendActivityEvent, createActivityRun, finishActivityRun, getActivityRun } from '@/lib/ai/activity'

export type DurableTaskCompletionInput = {
  userId: string; taskId: string; actor?: 'human' | 'agent' | 'novo'; source?: string
  observationId?: string; occurredAt?: Date; metadata?: Record<string, unknown>
}

export type CanonicalReplanResult = { planId?: string; recommendationTaskId?: string | null; [key: string]: unknown }
export type CanonicalReplan = (input: { userId: string; completedTaskId: string; attempt: number }) => Promise<CanonicalReplanResult>

export async function runCanonicalReplanWithRetry(
  input: { userId: string; completedTaskId: string },
  replan: CanonicalReplan,
  maxAttempts = 2,
) {
  const attempts = Math.max(1, maxAttempts)
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return { replanPending: false, replanAttempts: attempt, plan: await replan({ ...input, attempt }) } }
    catch (error) { lastError = error }
  }
  return { replanPending: true, replanAttempts: attempts, replanError: lastError instanceof Error ? lastError.message : 'replan_failed' }
}

const actionable = ['proposed', 'modified', 'accepted', 'started', 'postponed']

/** Canonical, provider-agnostic completion boundary for durable work. */
export async function completeDurableTask(input: DurableTaskCompletionInput) {
  const source = input.source ?? 'novo'
  const actor = input.actor ?? 'human'
  const idempotencyKey = `durable-task:${input.userId}:${input.taskId}:${input.observationId ?? 'completion'}`
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, userId: input.userId } })
    if (!task) throw new Error('task_not_found')
    const existing = await tx.outcomeEvent.findUnique({ where: { idempotencyKey } })
    const actions = await tx.recommendedAction.findMany({ where: { userId: input.userId, taskId: task.id, plan: { status: 'active' } }, orderBy: { createdAt: 'desc' } })
    if (!existing) {
      if (task.status !== 'done') await tx.task.update({ where: { id: task.id }, data: { status: 'done', version: { increment: 1 } } })
      for (const action of actions) if (actionable.includes(action.status)) {
        await tx.recommendedAction.update({ where: { id: action.id }, data: { status: 'completed', completedAt: input.occurredAt ?? new Date(), statusAt: new Date(), lastActor: actor, terminalReason: 'durable_task_completed' } })
      }
      const current = actions.find((a) => actionable.includes(a.status))
      let outcome
      try { outcome = await tx.outcomeEvent.create({ data: { userId: input.userId, planId: current?.planId, recommendedActionId: current?.id, type: 'completed', idempotencyKey, metadata: { taskId: task.id, source, actor, ...(input.metadata ?? {}) } } }) }
      catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error
        const raced = await tx.outcomeEvent.findUnique({ where: { idempotencyKey } })
        if (!raced) throw error
        await tx.cognitiveReplanRequest.upsert({ where: { outcomeEventId: raced.id }, create: { userId: input.userId, outcomeEventId: raced.id, completedTaskId: task.id }, update: {} })
        return { taskId: task.id, status: 'done', outcomeId: raced.id, idempotent: true }
      }
      await tx.cognitiveReplanRequest.create({ data: { userId: input.userId, outcomeEventId: outcome.id, completedTaskId: task.id } })
      return { taskId: task.id, status: 'done', outcomeId: outcome.id, idempotent: false }
    }
    await tx.cognitiveReplanRequest.upsert({ where: { outcomeEventId: existing.id }, create: { userId: input.userId, outcomeEventId: existing.id, completedTaskId: task.id }, update: {} })
    return { taskId: task.id, status: 'done', outcomeId: existing.id, idempotent: true }
  })
  // Activity is a durable, repairable projection. Every retry verifies the run exists;
  // a crash after the outcome commit can therefore be repaired without duplicating it.
  const activityId = `durable-task-${result.outcomeId}`
  let activity = await getActivityRun(input.userId, activityId)
  let run = activity?.run
  if (!run) {
    try { run = await createActivityRun(input.userId, 'novo_loop', activityId) }
    catch { activity = await getActivityRun(input.userId, activityId); if (!activity) throw new Error('activity_creation_failed'); run = activity.run }
  }
  if (!run) throw new Error('activity_creation_failed')
  if (run.status !== 'completed') {
    await appendActivityEvent(input.userId, { runId: run.id, phase: 'verifying_result', label: 'Trabajo completado', detail: `Trabajo durable reconciliado desde ${source}.` })
    await finishActivityRun(input.userId, run.id, 'completed', { resultRef: result.outcomeId, resultSummary: 'Outcome durable registrado.' })
  }
  return { ...result, replanPending: true }
}

/**
 * Completion boundary followed by the canonical planner boundary.  The planner
 * is injected so providers cannot bypass the normal deterministic planning path.
 * A failed planner never rolls back the durable completion; it remains pending
 * and can be retried safely with the same completion idempotency key.
 */
export async function completeDurableTaskAndReplan(
  input: DurableTaskCompletionInput,
  replan: CanonicalReplan,
  options: { maxAttempts?: number } = {},
) {
  const completion = await completeDurableTask(input)
  return { ...completion, ...await runCanonicalReplanWithRetry({ userId: input.userId, completedTaskId: input.taskId }, replan, options.maxAttempts ?? 2) }
}

export async function resolveCurrentRecommendedActionsForTask(userId: string, taskId: string) {
  return prisma.recommendedAction.findMany({ where: { userId, taskId, status: { in: actionable }, plan: { status: 'active' } }, orderBy: { priority: 'desc' } })
}
