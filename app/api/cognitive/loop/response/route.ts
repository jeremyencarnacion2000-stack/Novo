import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { actionResponseSchema } from '@/lib/schemas/cognitive-loop'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import { canTransitionRecommendation, isTerminalRecommendationState } from '@/lib/cognitive/action-state-machine'
import { appendActivityEvent, createActivityRun, finishActivityRun } from '@/lib/ai/activity'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

const analyticsByResponse: Record<string, any> = {
  accepted: 'recommendation_accepted', modified: 'recommendation_modified', postponed: 'recommendation_postponed',
  completed: 'recommended_action_completed', helpful: 'intervention_marked_helpful', unhelpful: 'intervention_marked_unhelpful',
  intrusive: 'intervention_marked_intrusive', started: 'recommended_action_started', abandoned: 'recommended_action_abandoned',
  failed: 'recommended_action_failed', dismissed: 'recommendation_dismissed',
}

const feedback = new Set(['helpful', 'unhelpful', 'intrusive'])

async function recordOutcomeActivity(userId: string, actionId: string, response: string) {
  try {
    const run = await createActivityRun(userId, 'novo_loop')
    if (response === 'accepted') {
      await appendActivityEvent(userId, { runId: run.id, phase: 'awaiting_confirmation', label: 'Confirmación registrada', detail: 'La acción fue autorizada por ti.', requiresConfirmation: true })
    } else if (response === 'started') {
      await appendActivityEvent(userId, { runId: run.id, phase: 'executing_action', label: 'Acción iniciada', detail: 'El estado de la acción fue actualizado.' })
    } else if (['completed', 'abandoned', 'failed'].includes(response)) {
      await appendActivityEvent(userId, { runId: run.id, phase: 'verifying_result', label: 'Verificando el resultado', detail: `Resultado registrado: ${response}.` })
    } else {
      await appendActivityEvent(userId, { runId: run.id, phase: 'composing_response', label: 'Registrando tu respuesta', detail: 'La preferencia quedó asociada a esta recomendación.' })
    }
    await appendActivityEvent(userId, { runId: run.id, phase: 'learning', label: 'Actualizando el aprendizaje', detail: 'La próxima recomendación podrá usar este resultado.' })
    await finishActivityRun(userId, run.id, 'completed', { resultRef: actionId, resultSummary: 'Outcome registrado para la próxima recomendación.' })
    return run.id
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = actionResponseSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid response', details: parsed.error.flatten() }, { status: 400 })
  const { actionId, response, note, reason, modifiedNextStep, idempotencyKey } = parsed.data
  const userId = session.user.id
  const action = await prisma.recommendedAction.findFirst({ where: { id: actionId, userId }, include: { plan: true } })
  if (!action) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })

  const existing = await prisma.outcomeEvent.findUnique({ where: { idempotencyKey } })
  if (existing) {
    if (existing.userId !== userId || existing.recommendedActionId !== action.id) return NextResponse.json({ error: 'Idempotency key conflict' }, { status: 409 })
    return NextResponse.json({ action, duplicate: true })
  }
  if (!canTransitionRecommendation(action.status, response)) {
    return NextResponse.json({ error: `Invalid transition from ${action.status} to ${response}` }, { status: 409 })
  }
  if (response === 'modified' && !modifiedNextStep) return NextResponse.json({ error: 'A modified next step is required' }, { status: 400 })

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
    let taskId = action.taskId
    if (response === 'accepted' && !taskId) {
      const task = await tx.task.create({ data: { userId, title: action.title, status: 'todo', priority: 'medium', tags: '[]' } })
      taskId = task.id
    }
    const now = new Date()
    const nextState = feedback.has(response) ? action.status : response
    const updated = await tx.recommendedAction.update({
      where: { id: action.id },
      data: {
        status: nextState, statusAt: now, responseNote: note, responseAt: now, lastActor: 'user',
        ...(taskId ? { taskId } : {}),
        ...(response === 'started' ? { startedAt: now } : {}),
        ...(response === 'modified' && modifiedNextStep ? { nextStep: modifiedNextStep } : {}),
        ...(response === 'completed' ? { completedAt: now } : {}),
        ...(isTerminalRecommendationState(nextState as any) ? { terminalReason: reason ?? response } : {}),
      },
    })
    await tx.outcomeEvent.create({ data: {
      userId, planId: action.planId, recommendedActionId: action.id, type: response,
      metadata: { actor: 'user', ...(reason ? { reason } : {}), ...(note ? { note } : {}) }, idempotencyKey,
    } })
    if (response === 'completed' && taskId) await tx.task.updateMany({ where: { id: taskId, userId }, data: { status: 'done' } })
    return updated
    })
  } catch (error: any) {
    // A second submission can win the race after the preflight query. Return
    // the persisted result instead of executing the state transition twice.
    if (error?.code === 'P2002') {
      const duplicate = await prisma.outcomeEvent.findUnique({ where: { idempotencyKey } })
      if (duplicate?.userId === userId && duplicate.recommendedActionId === action.id) return NextResponse.json({ action, duplicate: true })
    }
    throw error
  }
  await trackNovoLoopEvent(userId, analyticsByResponse[response], { actionId, planId: action.planId })
  const runId = await recordOutcomeActivity(userId, action.id, response)
  if (['completed', 'modified', 'postponed', 'dismissed', 'unhelpful', 'intrusive'].includes(response)) {
    void runAmbientTwinForUser(userId, { trigger: response === 'completed' ? 'task_completed' : 'user_correction' }).catch(() => undefined)
  }
  return NextResponse.json({ action: result, ...(runId ? { runId } : {}) })
}
