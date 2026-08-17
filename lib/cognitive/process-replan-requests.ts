import { prisma } from '@/lib/prisma'
import { planUserContext } from '@/lib/cognitive/canonical-planner'
import { appendActivityEvent, createActivityRun, finishActivityRun, getActivityRun } from '@/lib/ai/activity'

export async function processOneCognitiveReplanRequest(now = new Date(), userId?: string) {
  const candidate = await prisma.cognitiveReplanRequest.findFirst({ where: { ...(userId ? { userId } : {}), OR: [{ status: { in: ['pending', 'failed'] }, nextAttemptAt: { lte: now } }, { status: 'running', leaseExpiresAt: { lt: now } }] }, orderBy: { createdAt: 'asc' } })
  if (!candidate) return { processed: false as const }
  const claimToken = `${candidate.id}:${now.getTime()}:${Math.random().toString(36).slice(2)}`
  const leaseExpiresAt = new Date(now.getTime() + 5 * 60_000)
  const claimed = await prisma.cognitiveReplanRequest.updateMany({ where: { id: candidate.id, OR: [{ status: { in: ['pending', 'failed'] }, nextAttemptAt: { lte: now } }, { status: 'running', leaseExpiresAt: { lt: now } }] }, data: { status: 'running', attempts: { increment: 1 }, claimedAt: now, leaseExpiresAt, claimToken } })
  if (claimed.count !== 1) return { processed: false as const, raced: true as const }
  const finalize = async (data: Parameters<typeof prisma.cognitiveReplanRequest.update>[0]['data']) => { const r = await prisma.cognitiveReplanRequest.updateMany({ where: { id: candidate.id, status: 'running', claimToken }, data }); if (r.count !== 1) throw new Error('replan_lease_lost') }
  try {
    let persistedPlan = candidate.resultingActionPlanId ? await prisma.actionPlan.findFirst({ where: { id: candidate.resultingActionPlanId, userId: candidate.userId, status: 'active' }, include: { actions: true } }) : null
    if (!persistedPlan) {
      const planningRun = await createActivityRun(candidate.userId, 'novo_loop', `replan-${candidate.id}`)
      const result = await planUserContext({ userId: candidate.userId, timezone: 'UTC', trigger: 'durable_replan', runId: planningRun.id })
      persistedPlan = await prisma.actionPlan.findFirst({ where: { id: result.plan.id, userId: candidate.userId, status: 'active' }, include: { actions: true } })
    }
    if (!persistedPlan) throw new Error('resulting_plan_not_persisted')
    if (persistedPlan.actions.some((action) => action.taskId === candidate.completedTaskId)) throw new Error('completed_task_recommended')
    const adaptationRunId = `adaptation-${candidate.id}`
    let existingRun = await getActivityRun(candidate.userId, adaptationRunId)
    const run = existingRun?.run ?? await (async () => {
      try { return await createActivityRun(candidate.userId, 'novo_loop', adaptationRunId) }
      catch (error) {
        existingRun = await getActivityRun(candidate.userId, adaptationRunId)
        if (!existingRun) throw error
        return existingRun.run
      }
    })()
    const next = persistedPlan.actions[0]
    const priorEvents = existingRun?.events ?? (await getActivityRun(candidate.userId, run.id))?.events ?? []
    if (!priorEvents.some((event) => event.label === 'ADAPTED')) await appendActivityEvent(candidate.userId, { runId: run.id, phase: 'learning', label: 'ADAPTED', detail: 'La siguiente recomendación fue recalculada después de tu resultado.' })
    const refreshed = await getActivityRun(candidate.userId, run.id)
    if (!refreshed?.events.some((event) => event.label === 'NEXT')) await appendActivityEvent(candidate.userId, { runId: run.id, phase: 'planning', label: 'NEXT', detail: next ? `Siguiente acción: ${next.title}` : 'No hay siguiente acción disponible.' })
    await finishActivityRun(candidate.userId, run.id, 'completed', { resultRef: persistedPlan.id, resultSummary: 'Nueva recomendación adaptada.' })
    await finalize({ status: 'completed', resultingActionPlanId: persistedPlan.id, completedAt: new Date(), lastError: null, leaseExpiresAt: null, claimToken: null })
    return { processed: true as const, requestId: candidate.id, actionPlanId: persistedPlan.id }
  } catch (error) {
    // Losing a lease is expected when another worker legitimately recovers
    // the request. Never mark it failed or emit a user-facing error: the
    // winning worker owns all subsequent durable mutations.
    if (error instanceof Error && error.message === 'replan_lease_lost') {
      return { processed: false as const, leaseLost: true as const, requestId: candidate.id }
    }
    await finalize({ status: 'failed', lastError: error instanceof Error ? error.message : 'replan_failed', nextAttemptAt: new Date(Date.now() + 60_000), leaseExpiresAt: null, claimToken: null })
    return { processed: true as const, failed: true as const, requestId: candidate.id }
  }
}
