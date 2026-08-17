import { prisma } from '@/lib/prisma'
import { evaluateInitiative, isSignificantAmbientTrigger } from '@/lib/cognitive/ambient-twin-policy'
import { asRecord, fingerprint, isActiveRecommendation } from '@/lib/cognitive/ambient-twin-primitives'
import { planUserContext } from '@/lib/cognitive/canonical-planner'
import { processOneCognitiveReplanRequest } from '@/lib/cognitive/process-replan-requests'
import { getOrCreateTwin } from '@/lib/cognitive/get-or-create-twin'
import { appendActivityEvent, createActivityRun, finishActivityRun, getActivityRun } from '@/lib/ai/activity'

export type AmbientTrigger = 'startup' | 'sync' | 'task_created' | 'task_completed' | 'calendar_changed' | 'agent_outcome' | 'focus_completed' | 'user_correction'
export type AmbientRecommendation = { id: string; title: string; nextStep: string; taskId: string | null; estimatedMinutes: number | null; confidence: number; explanation: string; status: string }
export type AmbientTwinState = {
  status: 'active' | 'paused' | 'insufficient_context'
  trigger: AmbientTrigger | string
  observedAt: string
  contextChanged: boolean
  deadlineApproaching: boolean
  contextFingerprint: string
  summary: string
  sources: string[]
  facts: string[]
  constraints: string[]
  recommendation: AmbientRecommendation | null
  question?: string
  initiative: ReturnType<typeof evaluateInitiative>
  planning: 'not_needed' | 'completed' | 'pending' | 'insufficient_context' | 'failed'
  planningError?: string
  permissions: Array<{ provider: string; status: 'enabled' | 'paused' | 'revoked' }>
}

export async function readAmbientTwinState(userId: string, options: { trigger?: AmbientTrigger | string; now?: Date } = {}): Promise<AmbientTwinState> {
  const now = options.now ?? new Date(); const trigger = options.trigger ?? 'startup'; const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000); const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [settings, twin, plan, tasks, events, blocks, logs, pending, focus, routines, outcomes, signals, sourcePreferences, permissions] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { settings: true } }),
    prisma.cognitiveTwinRecord.findUnique({ where: { userId }, select: { id: true, metrics: true, confidenceScore: true, isInitialized: true } }),
    prisma.actionPlan.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' }, include: { actions: { orderBy: { priority: 'desc' }, take: 3 } } }),
    prisma.task.findMany({ where: { userId, status: { in: ['todo', 'in-progress'] } }, select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 40 }),
    prisma.calendarEvent.findMany({ where: { userId, start: { gte: now, lte: horizon } }, select: { id: true, title: true, start: true }, orderBy: { start: 'asc' }, take: 10 }),
    prisma.timeBlock.findMany({ where: { userId, startTime: { gte: now, lte: horizon } }, select: { id: true, title: true, startTime: true }, orderBy: { startTime: 'asc' }, take: 10 }),
    prisma.twinEvolutionLog.findMany({ where: { userId, createdAt: { gte: since } }, select: { changeType: true, description: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.cognitiveReplanRequest.findFirst({ where: { userId, status: { in: ['pending', 'failed', 'running'] } }, select: { id: true, status: true } }),
    prisma.focusSession.findFirst({ where: { userId, endTime: null, sessionType: 'work' }, select: { id: true } }),
    prisma.routine.findMany({ where: { userId, isActive: true }, select: { id: true, name: true, scheduledTime: true, timeOfDay: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 10 }),
    prisma.outcomeEvent.findMany({ where: { userId, createdAt: { gte: since } }, select: { id: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.behavioralSignal.findMany({ where: { userId, occurredAt: { gte: since } }, select: { id: true, signal: true, occurredAt: true }, orderBy: { occurredAt: 'desc' }, take: 20 }),
    prisma.novoSignalSourcePreference.findMany({ where: { userId }, select: { source: true, excludedAt: true } }),
    prisma.integrationPermission.findMany({ where: { userId }, select: { provider: true, revokedAt: true } }),
  ])
  const prefs = asRecord(settings?.settings); const metrics = asRecord(twin?.metrics); const ambient = asRecord(metrics.ambient); const paused = prefs.ambientTwinPaused === true || prefs.cognitiveLearningPaused === true; const action = plan?.actions.find((item) => isActiveRecommendation(item.status)) ?? null; const task = tasks.find((item) => item.priority === 'high') ?? tasks[0] ?? null; const event = [...events.map((item) => ({ id: item.id, title: item.title, start: item.start })), ...blocks.map((item) => ({ id: item.id, title: item.title, start: item.startTime }))].sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null
  const excludedSources = new Set(sourcePreferences.filter((item) => item.excludedAt).map((item) => item.source)); const sources = [...new Set([twin ? 'twin' : null, !excludedSources.has('tasks') && tasks.length ? 'tasks' : null, !excludedSources.has('calendar') && (events.length || blocks.length) ? 'calendar' : null, !excludedSources.has('routines') && routines.length ? 'routines' : null, !excludedSources.has('outcomes') && outcomes.length ? 'outcomes' : null, !excludedSources.has('behavioral_signals') && signals.length ? 'behavioral_signals' : null, logs.length ? 'evolution' : null, pending ? 'replan' : null].filter((source): source is string => Boolean(source)))]
  const contextFingerprint = fingerprint({ actionId: action?.id ?? null, taskIds: tasks.slice(0, 10).map((item) => `${item.id}:${item.status}:${item.updatedAt.toISOString()}`), eventIds: [...events.map((item) => `${item.id}:${item.start.toISOString()}`), ...blocks.map((item) => `${item.id}:${item.startTime.toISOString()}`)].slice(0, 10), routineIds: routines.slice(0, 5).map((item) => `${item.id}:${item.updatedAt.toISOString()}`), outcomeIds: outcomes.slice(0, 5).map((item) => `${item.id}:${item.type}`), signalIds: signals.slice(0, 5).map((item) => `${item.id}:${item.signal}`), pendingId: pending?.id ?? null })
  const deadlineApproaching = tasks.some((item) => { const due = item.dueDate ? Date.parse(item.dueDate) : Number.NaN; return Number.isFinite(due) && due >= now.getTime() && due <= now.getTime() + 24 * 60 * 60 * 1000 }); const contextChanged = contextFingerprint !== String(ambient.contextFingerprint ?? ''); const available = Boolean(twin?.isInitialized && (action || task || event || routines.length || outcomes.length || signals.length || logs.length || pending)); const relevance = isSignificantAmbientTrigger(trigger) || deadlineApproaching ? 0.8 : 0.2; const urgency = event ? 0.8 : deadlineApproaching ? 0.9 : task?.priority === 'high' ? 0.7 : 0; const initiative = available ? evaluateInitiative({ relevance, confidence: Number(twin?.confidenceScore ?? 0) / 100, urgency, interruptibility: focus ? 0.25 : 0.72, contextChanged, proactivePaused: prefs.proactiveSuggestionsPaused === true }) : 'SILENT_LEARN'
  const recommendation = action ? { id: action.id, title: action.title, nextStep: action.nextStep, taskId: action.taskId, estimatedMinutes: action.estimatedMinutes, confidence: action.confidence, explanation: action.explanation, status: action.status } : null
  const summary = paused ? 'Novo está en pausa y no observará nuevas fuentes hasta que lo reactives.' : !available ? 'Novo todavía está construyendo suficiente contexto actual para priorizar con confianza.' : recommendation ? `Ahora importa: ${recommendation.title}` : task ? `El siguiente contexto relevante es: ${task.title}` : 'El contexto actual no requiere una intervención.'
  const question = initiative === 'ASK_USER' ? event && task ? `Tienes "${task.title}" pendiente y un compromiso próximo. ¿Quieres que ajuste el siguiente bloque?` : task ? `La tarea "${task.title}" sigue activa. ¿La mantienes como prioridad ahora?` : event ? 'Tienes un compromiso próximo. ¿Quieres que prepare el contexto?' : '¿Qué debería tratar como prioridad en este momento?' : undefined
  return { status: paused ? 'paused' : available ? 'active' : 'insufficient_context', trigger, observedAt: now.toISOString(), contextChanged, deadlineApproaching, contextFingerprint, summary, sources, facts: [recommendation ? `Plan activo: ${recommendation.title}` : null, task ? `${tasks.length} tarea(s) pendiente(s)` : null, deadlineApproaching ? 'Hay una fecha límite próxima' : null, event ? `Próximo compromiso: ${event.title}` : null, routines[0] ? `Rutina activa: ${routines[0].name}` : null, outcomes[0] ? `Resultado reciente: ${outcomes[0].type}` : null, signals[0] ? `Señal reciente: ${signals[0].signal}` : null, logs[0] ? `Cambio reciente: ${logs[0].description}` : null].filter((fact): fact is string => Boolean(fact)).slice(0, 5), constraints: [event ? 'Hay un compromiso próximo' : null, deadlineApproaching ? 'Hay una fecha límite próxima' : null, task?.priority === 'high' ? 'Hay una tarea prioritaria' : null, focus ? 'Sesión de foco activa' : null, pending ? 'Hay una adaptación pendiente' : null].filter((constraint): constraint is string => Boolean(constraint)), recommendation, question, initiative, planning: pending ? 'pending' : 'not_needed', permissions: permissions.map((permission) => ({ provider: permission.provider, status: permission.revokedAt ? 'revoked' as const : 'enabled' as const })) }
}

async function persistAmbientObservation(userId: string, state: AmbientTwinState, now: Date) {
  if (state.status !== 'active' || !state.contextChanged) return
  const twin = await getOrCreateTwin(userId); const existing = await prisma.novoSignalLedger.findUnique({ where: { userId_fingerprint: { userId, fingerprint: `ambient:${state.contextFingerprint}` } }, select: { id: true } })
  if (!existing) { await prisma.novoSignalLedger.create({ data: { userId, fingerprint: `ambient:${state.contextFingerprint}`, source: 'ambient', sourceRef: state.trigger, signalType: 'current_context_reconciled', label: state.summary.slice(0, 240), observedAt: now, reliability: 'deterministic' } }); await prisma.twinEvolutionLog.create({ data: { twinId: twin.id, userId, changeType: 'ambient_context_updated', description: state.summary.slice(0, 240), newValue: JSON.stringify({ fingerprint: state.contextFingerprint, trigger: state.trigger }) } }) }
  const metrics = asRecord(twin.metrics); await prisma.cognitiveTwinRecord.update({ where: { userId }, data: { metrics: { ...metrics, ambient: { ...asRecord(metrics.ambient), contextFingerprint: state.contextFingerprint, lastObservedAt: now.toISOString(), lastTrigger: state.trigger, initiative: state.initiative } } } })
  const runId = `ambient-twin:${state.contextFingerprint}`; const current = await getActivityRun(userId, runId); const run = current?.run ?? await (async () => { try { return await createActivityRun(userId, 'novo_loop', runId) } catch { return (await getActivityRun(userId, runId))?.run ?? null } })(); if (!run || run.status === 'completed') return
  await appendActivityEvent(userId, { runId: run.id, phase: 'retrieving_context', label: 'Novo observó un cambio', detail: state.summary, sourceCount: state.sources.length }); await appendActivityEvent(userId, { runId: run.id, phase: 'evaluating_constraints', label: 'Evaluando si importa ahora', detail: state.constraints.join(' · ') || 'No hay restricciones inmediatas.' }); await appendActivityEvent(userId, { runId: run.id, phase: state.initiative === 'SILENT_LEARN' ? 'learning' : 'adapting', label: state.initiative === 'SILENT_LEARN' ? 'Aprendizaje silencioso' : 'Contexto listo para adaptar', detail: state.initiative }); await finishActivityRun(userId, run.id, 'completed', { resultRef: state.contextFingerprint, resultSummary: state.summary.slice(0, 240) })
}

export async function runAmbientTwinForUser(userId: string, options: { trigger: AmbientTrigger; timezone?: string; now?: Date }) {
  const state = await readAmbientTwinState(userId, options); if (state.status !== 'active') return state; const now = options.now ?? new Date(); await persistAmbientObservation(userId, state, now); let planning: AmbientTwinState['planning'] = state.planning; let planningError: string | undefined
  if ((isSignificantAmbientTrigger(options.trigger) || (options.trigger === 'sync' && state.deadlineApproaching)) && state.contextChanged) { try { const replan = await processOneCognitiveReplanRequest(now, userId); const failed = 'failed' in replan && replan.failed; const leasedByAnotherWorker = ('leaseLost' in replan && replan.leaseLost) || ('raced' in replan && replan.raced); if (replan.processed && !failed) planning = 'completed'; else if (failed) planning = 'failed'; else if (leasedByAnotherWorker) planning = 'pending'; else { const snapshot = await prisma.cognitiveStateSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } }); if (snapshot) { await planUserContext({ userId, timezone: options.timezone ?? 'UTC', snapshotId: snapshot.id, trigger: `ambient:${options.trigger}` }); planning = 'completed' } else planning = 'insufficient_context' } } catch (error) { planning = error instanceof Error && ['no_recommendation', 'state_snapshot_required'].includes(error.message) ? 'insufficient_context' : 'failed'; planningError = error instanceof Error ? error.message : 'ambient_planning_failed' } }
  return { ...state, planning, ...(planningError ? { planningError } : {}) }
}
