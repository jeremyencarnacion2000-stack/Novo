import { prisma } from '@/lib/prisma'
import { choosePrimaryRecommendation } from '@/lib/cognitive/decision-rules'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { parsePersistedTwinAdaptationProposals } from '@/lib/cognitive/twin-adaptation'
import { appendActivityEvent, createActivityRun, finishActivityRun, getActivityRun } from '@/lib/ai/activity'

export type CanonicalPlanInput = { userId: string; goalId?: string; timezone: string; snapshotId?: string; trigger?: string; runId?: string }

/** The single server-side planning authority used by HTTP and background work. */
export async function planUserContext(input: CanonicalPlanInput) {
  const { userId } = input
  const activity = input.runId ? await getActivityRun(userId, input.runId) : { run: await createActivityRun(userId, 'novo_loop'), events: [] }
  if (!activity) throw new Error('activity_run_not_found')
  const runId = activity.run.id
  await appendActivityEvent(userId, { runId, phase: 'retrieving_context', label: 'Recuperando tu contexto', detail: 'Consultando objetivo, estado, tareas y resultados recientes.' })
  const [requestedGoal, latestGoal, snapshot, tasks, recentOutcomes, completedActions, excludedSignals, sourcePreferences, twin] = await Promise.all([
    input.goalId ? prisma.goal.findFirst({ where: { id: input.goalId, userId, status: 'active' } }) : Promise.resolve(null),
    prisma.goal.findFirst({ where: { userId, status: 'active' }, orderBy: { updatedAt: 'desc' } }),
    input.snapshotId ? prisma.cognitiveStateSnapshot.findFirst({ where: { id: input.snapshotId, userId } }) : prisma.cognitiveStateSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.task.findMany({ where: { userId, status: { in: ['todo', 'in-progress'] } }, select: { id: true, title: true, priority: true, dueDate: true, updatedAt: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 40 }),
    prisma.outcomeEvent.findMany({ where: { userId, type: { in: ['dismissed', 'postponed', 'unhelpful', 'intrusive', 'abandoned', 'failed'] }, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }, include: { recommendedAction: { select: { title: true, taskId: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.recommendedAction.findMany({ where: { userId, status: 'completed', startedAt: { not: null }, completedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { startedAt: true, completedAt: true }, orderBy: { completedAt: 'desc' }, take: 12 }),
    prisma.novoSignalLedger.findMany({ where: { userId, OR: [{ excludedAt: { not: null } }, { correctedAt: { not: null } }] }, select: { source: true, sourceRef: true, signalType: true, excludedAt: true, correction: true }, take: 200 }),
    prisma.novoSignalSourcePreference.findMany({ where: { userId, excludedAt: { not: null } }, select: { source: true } }),
    prisma.cognitiveTwinRecord.findUnique({ where: { userId }, select: { identity: true } }),
  ])
  if (input.goalId && !requestedGoal) throw new Error('goal_not_found')
  // Keep the durable activity trace aligned with the Twin's inference
  // protocol: context retrieval is followed by explicit interpretation and
  // prioritisation before the recommendation is persisted. These events are
  // part of the user-visible proof that planning is an adaptive pipeline, not
  // a single opaque database write.
  await appendActivityEvent(userId, { runId, phase: 'interpreting_signals', label: 'Interpretando las señales', detail: 'Separando hechos, preferencias y evidencia reciente.' })
  await appendActivityEvent(userId, { runId, phase: 'prioritizing', label: 'Priorizando el siguiente paso', detail: 'Aplicando objetivo, capacidad disponible y correcciones del Twin.' })
  if (!snapshot) throw new Error('state_snapshot_required')
  await appendActivityEvent(userId, { runId, phase: 'planning', label: 'Preparando tu siguiente acción', detail: 'Guardando una recomendación ejecutable y explicable.' })
  const candidateGoal = requestedGoal ?? latestGoal
  await upsertNovoSignals(userId, [
    { source: 'checkin', sourceRef: snapshot.id, signalType: 'operating_state', label: 'Current self-reported operating state', observedAt: snapshot.createdAt, reliability: 'user_reported' },
    ...(candidateGoal ? [{ source: 'goal' as const, sourceRef: candidateGoal.id, signalType: 'active_objective', label: candidateGoal.title, observedAt: candidateGoal.updatedAt, reliability: 'direct' as const }] : []),
    ...tasks.map((task) => ({ source: 'task' as const, sourceRef: task.id, signalType: 'unfinished_task', label: task.title, observedAt: task.updatedAt, reliability: 'direct' as const })),
  ])
  const isExcluded = (source: string, sourceRef?: string | null, signalType?: string) => sourcePreferences.some((p) => p.source === source) || excludedSignals.some((s) => s.excludedAt && s.source === source && s.sourceRef === (sourceRef ?? null) && (!signalType || s.signalType === signalType))
  const correctedLabel = (source: string, sourceRef: string, signalType: string, fallback: string) => excludedSignals.find((s) => s.source === source && s.sourceRef === sourceRef && s.signalType === signalType)?.correction?.trim() || fallback
  const goal = candidateGoal && !isExcluded('goal', candidateGoal.id, 'active_objective') ? { ...candidateGoal, title: correctedLabel('goal', candidateGoal.id, 'active_objective', candidateGoal.title) } : null
  const planningTasks = tasks.filter((t) => !isExcluded('task', t.id, 'unfinished_task')).map((t) => ({ ...t, title: correctedLabel('task', t.id, 'unfinished_task', t.title) }))
  const completedMinutes = completedActions.flatMap((i) => i.startedAt && i.completedAt ? [Math.round((i.completedAt.getTime() - i.startedAt.getTime()) / 60000)].filter((m) => m >= 5 && m <= 90) : []).sort((a, b) => a - b)
  const preferredSuccessfulMinutes = completedMinutes.length ? completedMinutes[Math.floor(completedMinutes.length / 2)] : null
  const adaptationPolicy = { proposals: parsePersistedTwinAdaptationProposals(twin?.identity) }
  const recommendation = choosePrimaryRecommendation({ now: new Date(), energy: snapshot.energy ?? 3, focus: snapshot.focus ?? 3, workload: snapshot.workload ?? 3, availableMinutes: snapshot.availableMinutes ?? 15, goal, tasks: planningTasks, recentlyDismissedTitles: recentOutcomes.filter((e) => e.type === 'dismissed').flatMap((e) => e.recommendedAction?.title ? [e.recommendedAction.title] : []), recentlyPostponedTaskIds: recentOutcomes.filter((e) => e.type === 'postponed').flatMap((e) => e.recommendedAction?.taskId ? [e.recommendedAction.taskId] : []), recentlyUnhelpfulTitles: recentOutcomes.filter((e) => e.type === 'unhelpful').flatMap((e) => e.recommendedAction?.title ? [e.recommendedAction.title] : []), recentlyIntrusiveTitles: recentOutcomes.filter((e) => e.type === 'intrusive').flatMap((e) => e.recommendedAction?.title ? [e.recommendedAction.title] : []), preferredSuccessfulMinutes, adaptationPolicy })
  if (!recommendation) throw new Error('no_recommendation')
  const plan = await prisma.$transaction(async (tx) => {
    if (recommendation.taskId && !(await tx.task.findFirst({ where: { id: recommendation.taskId, userId, status: { not: 'done' } }, select: { id: true } }))) throw new Error('task_completed_during_planning')
    await tx.actionPlan.updateMany({ where: { userId, status: 'active' }, data: { status: 'superseded' } })
    return tx.actionPlan.create({ data: { userId, goalId: goal?.id, stateSnapshotId: snapshot.id, planningDate: new Date(), timezone: input.timezone, reasoningSummary: recommendation.explanation, inputs: { taskCount: planningTasks.length, snapshotId: snapshot.id, outcomeCount: recentOutcomes.length, trigger: input.trigger ?? 'user_request', adaptationPolicyIds: adaptationPolicy.proposals.map((p) => p.id) }, algorithmVersion: 'novo-loop-rules-v1', actions: { create: { userId, taskId: recommendation.taskId, title: recommendation.title, nextStep: recommendation.nextStep, priority: recommendation.score, estimatedMinutes: recommendation.estimatedMinutes, confidence: recommendation.confidence, explanation: recommendation.explanation, facts: recommendation.facts, inferences: recommendation.inferences } } }, include: { actions: true, goal: { select: { title: true } } } })
  })
  await finishActivityRun(userId, runId, 'completed', { resultRef: plan.id, resultSummary: 'Plan generado y guardado.' })
  return { plan, runId }
}
