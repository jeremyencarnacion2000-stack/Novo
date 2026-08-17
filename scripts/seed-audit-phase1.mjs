import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const RESERVED_AUDIT_EMAIL = 'audit-phase1@novo.test.invalid'
export const RESERVED_AUDIT_USER_ID = 'audit-phase1-user-reserved'

const branchMarker = /(?:^|[^a-z0-9])(test|e2e)(?:$|[^a-z0-9])/i
const summaryKeys = [
  'users', 'settings', 'profiles', 'twins', 'goals', 'projects', 'tasks',
  'checkins', 'behavioralSignals', 'ledgerSignals', 'evolutionLogs', 'snapshots',
  'plans', 'recommendations', 'outcomes', 'activityRuns', 'activityEvents',
  'aiConversations', 'chatSessions',
]

export function normalizePostgresIdentity(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('SAFE_GATE: PostgreSQL URL is invalid')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('SAFE_GATE: PostgreSQL URL is required')
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, '').split('/')[0] ?? '')
  if (!url.hostname || !database) throw new Error('SAFE_GATE: PostgreSQL host and database are required')
  return { host: url.hostname.toLowerCase(), port: url.port || '5432', database: database.toLowerCase() }
}

export function assertSafeEnvironment(env) {
  if (env.NODE_ENV !== 'test') throw new Error('SAFE_GATE: NODE_ENV=test is required')
  if (env.NOVO_ISOLATED_E2E !== 'true') throw new Error('SAFE_GATE: NOVO_ISOLATED_E2E=true is required')
  if (env.VERCEL_ENV === 'production') throw new Error('SAFE_GATE: VERCEL_ENV=production is rejected')
  if (!env.DATABASE_URL_TEST) throw new Error('SAFE_GATE: DATABASE_URL_TEST is required')
  if (env.DATABASE_URL !== env.DATABASE_URL_TEST) {
    throw new Error('SAFE_GATE: DATABASE_URL must equal DATABASE_URL_TEST (use run-isolated-db-command)')
  }
  if (!env.DATABASE_URL_PRODUCTION) throw new Error('SAFE_GATE: DATABASE_URL_PRODUCTION is required')
  if (!branchMarker.test(env.DATABASE_TEST_BRANCH ?? '')) {
    throw new Error('SAFE_GATE: DATABASE_TEST_BRANCH must include a test or e2e marker')
  }
  if (typeof env.NOVO_AUDIT_SEED_PASSWORD !== 'string' || env.NOVO_AUDIT_SEED_PASSWORD.length < 12) {
    throw new Error('SAFE_GATE: NOVO_AUDIT_SEED_PASSWORD must be at least 12 characters')
  }

  const testIdentity = normalizePostgresIdentity(env.DATABASE_URL_TEST)
  const productionIdentity = normalizePostgresIdentity(env.DATABASE_URL_PRODUCTION)
  if (testIdentity.host === productionIdentity.host && testIdentity.port === productionIdentity.port && testIdentity.database === productionIdentity.database) {
    throw new Error('SAFE_GATE: DATABASE_URL_TEST must not overlap DATABASE_URL_PRODUCTION')
  }
}

export function formatSeedSummary(counts) {
  const countText = summaryKeys.map((key) => `${key}=${Number(counts[key] ?? 0)}`).join(' ')
  return `AUDIT_PHASE1_SEED synthetic user=${RESERVED_AUDIT_USER_ID} email=${RESERVED_AUDIT_EMAIL} ${countText}`
}

const agoAtHour = (now, daysAgo, hour) => {
  const result = new Date(now)
  result.setUTCDate(result.getUTCDate() - daysAgo)
  result.setUTCHours(hour, 15, 0, 0)
  return result
}

export function buildCurrentRecommendationEvidence() {
  return {
    facts: ['Check-in: energía 4/5 y 50 minutos disponibles.', 'Tarea prioritaria en progreso.'],
    inferences: ['La mañana probablemente reduce la fricción de contexto.'],
  }
}

export function buildAuditLedgerSignals({ completedTaskId, checkinId, nextTaskId, now }) {
  return [
    { userId: RESERVED_AUDIT_USER_ID, fingerprint: 'audit-phase1-peak-window', source: 'task', sourceRef: completedTaskId, signalType: 'peak_window_observation', label: 'Ventana pico observada al completar una tarea', observedAt: agoAtHour(now, 1, 10), reliability: 'direct' },
    { userId: RESERVED_AUDIT_USER_ID, fingerprint: 'audit-phase1-chronotype', source: 'checkin', sourceRef: checkinId, signalType: 'chronotype_observation', label: 'Cronotipo matutino reportado para el bloque de enfoque', observedAt: agoAtHour(now, 0, 8), reliability: 'user_reported', correctedAt: agoAtHour(now, 0, 8), correction: 'Cronotipo confirmado por la persona: mejor energía por la mañana.' },
    { userId: RESERVED_AUDIT_USER_ID, fingerprint: 'audit-phase1-context-switching', source: 'task', sourceRef: nextTaskId, signalType: 'context_switching_observation', label: 'Cambio de contexto observado antes de una tarea prioritaria', observedAt: agoAtHour(now, 9, 16), reliability: 'direct' },
    { userId: RESERVED_AUDIT_USER_ID, fingerprint: 'audit-phase1-schedule-exception', source: 'task', sourceRef: nextTaskId, signalType: 'schedule_exception', label: 'Excepción de agenda que no representa el patrón habitual', observedAt: agoAtHour(now, 8, 12), reliability: 'direct', excludedAt: agoAtHour(now, 8, 12), exclusionReason: 'La persona indicó que ese día no representa su rutina.' },
  ]
}

export function buildAuditActivitySchedule({ now, runId, stageCount }) {
  const completedAt = new Date(now)
  const startedAt = new Date(now.getTime() - (stageCount + 1) * 60_000)
  const expiresAt = new Date(now.getTime() + 30 * 60_000)
  const interval = (completedAt.getTime() - startedAt.getTime()) / (stageCount + 1)
  return {
    startedAt,
    completedAt,
    expiresAt,
    events: Array.from({ length: stageCount }, (_, index) => ({
      runId,
      sequence: index + 1,
      timestamp: new Date(startedAt.getTime() + interval * (index + 1)),
    })),
  }
}

export const buildActivityEvents = (runId, stages, schedule) => stages.map((stage, index) => ({
  id: randomUUID(),
  runId,
  sequence: index + 1,
  phase: stage.phase,
  label: stage.label,
  detail: stage.detail,
  sourceCount: stage.sourceCount,
  terminal: stage.phase === 'completed',
  timestamp: schedule.events[index].timestamp,
}))

async function replaceAuditUser({ prisma, passwordHash, now }) {
  return prisma.$transaction(async (tx) => {
    const [byId, byEmail] = await Promise.all([
      tx.user.findUnique({ where: { id: RESERVED_AUDIT_USER_ID }, select: { id: true, email: true } }),
      tx.user.findUnique({ where: { email: RESERVED_AUDIT_EMAIL }, select: { id: true, email: true } }),
    ])
    if (byId && byId.email !== RESERVED_AUDIT_EMAIL) throw new Error('SAFE_GATE: reserved user id collides with another email')
    if (byEmail && byEmail.id !== RESERVED_AUDIT_USER_ID) throw new Error('SAFE_GATE: reserved email collides with another id')

    // UserSettings has no Prisma relation in this schema; it is still strictly
    // scoped to the reserved user and must be cleared before the replacement.
    await tx.userSettings.deleteMany({ where: { userId: RESERVED_AUDIT_USER_ID } })
    if (byId) await tx.user.delete({ where: { id: RESERVED_AUDIT_USER_ID } })

    const user = await tx.user.create({
      data: {
        id: RESERVED_AUDIT_USER_ID,
        email: RESERVED_AUDIT_EMAIL,
        name: 'Auditoría visual Fase 1',
        password: passwordHash,
        role: 'user',
        plan: 'pro',
        isPublic: false,
      },
    })
    await tx.userSettings.create({
      data: {
        userId: user.id,
        theme: 'dark',
        language: 'es',
        settings: { cognitiveLearningPaused: false, learningEnabled: true, auditSeed: 'phase1-synthetic' },
      },
    })
    await tx.cognitiveProfile.create({
      data: {
        userId: user.id,
        preferredWorkPeriods: ['09:00-11:30', '15:30-17:00'],
        typicalSessionMinutes: 50,
        planningPreference: 'guided',
        interruptionTolerance: 'low',
        notificationPreference: 'important',
        constraints: ['Evitar cambios de contexto durante bloques profundos.'],
        proactiveEnabled: true,
      },
    })
    const twin = await tx.cognitiveTwinRecord.create({
      data: {
        userId: user.id,
        confidenceScore: 74,
        trustLevel: 'adapted',
        isInitialized: true,
        onboardingCompletedAt: agoAtHour(now, 25, 10),
        longTermGoal: 'Consolidar una rutina sostenible para terminar el portafolio profesional.',
        identity: {
          name: 'Perfil de auditoría sintético',
          adaptationPolicy: {
            proposals: [
              { id: 'respect_peak_window', reason: 'La mañana concentra sesiones terminadas.', behavior: 'Priorizar trabajo exigente entre 09:00 y 11:30.' },
              { id: 'reduce_context_switching', reason: 'Cambiar de tarea reduce el foco observado.', behavior: 'Proponer una sola siguiente acción por bloque.' },
              { id: 'use_validated_pattern', reason: 'El patrón se sostuvo durante varias semanas.', behavior: 'Usar el patrón como contexto, no como hecho nuevo.' },
            ],
          },
        },
        energyCurve: { chronotype: 'morning_lark', peakFocusStart: '09:00', peakFocusEnd: '11:30' },
        metrics: { completedSessions: 6, observedDays: 24 },
        bottlenecks: { mainFrictionPoint: 'context_switching' },
        workspaceLayout: { primarySurface: 'cognitive-command' },
        totalSignals: 6,
      },
    })
    const goal = await tx.goal.create({
      data: {
        title: 'Publicar el portafolio de producto',
        description: 'Preparar tres casos de estudio sintéticos y una página de presentación.',
        status: 'active', timeframe: 'quarter', priority: 'high', progress: 45,
        deadline: agoAtHour(now, -12, 12).toISOString(), successCondition: 'Tres casos revisados y publicados.',
        source: 'onboarding', userId: user.id,
      },
    })
    const project = await tx.project.create({
      data: {
        title: 'Portafolio: caso de estudio principal', description: 'Caso sintético para recertificación visual.',
        status: 'in-progress', priority: 'high', progress: 50, tags: JSON.stringify(['portafolio', 'foco']),
        notes: 'Escenario de auditoría, sin datos reales.', startDate: agoAtHour(now, 20, 9).toISOString(),
        dueDate: agoAtHour(now, -10, 17).toISOString(), userId: user.id,
      },
    })
    const completedTask = await tx.task.create({
      data: {
        title: 'Definir el esquema del caso de estudio', status: 'done', priority: 'high',
        dueDate: agoAtHour(now, 2, 11).toISOString(), projectId: project.id, tags: JSON.stringify(['portafolio']),
        scheduledHour: 9, scheduledReason: 'Completada durante una ventana de foco observada.', userId: user.id,
      },
    })
    const nextTask = await tx.task.create({
      data: {
        title: 'Redactar la sección de impacto medible', status: 'in-progress', priority: 'high',
        dueDate: agoAtHour(now, -2, 11).toISOString(), projectId: project.id, tags: JSON.stringify(['portafolio', 'siguiente-paso']),
        scheduledHour: 9, scheduledReason: 'Próximo bloque de alta energía.', userId: user.id,
      },
    })
    const checkin = await tx.cognitiveStateSnapshot.create({
      data: { userId: user.id, energy: 4, focus: 4, availableMinutes: 50, workload: 3, currentContext: 'Redacción del caso de estudio sintético.', source: 'checkin', completeness: 1, createdAt: agoAtHour(now, 0, 8) },
    })

    await tx.behavioralSignal.createMany({ data: [
      { userId: user.id, twinId: twin.id, signal: 'focus_finished', hour: 10, duration: 52, quality: 4, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 24, 10) },
      { userId: user.id, twinId: twin.id, signal: 'task_completed', hour: 9, duration: 48, quality: 5, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 19, 9) },
      { userId: user.id, twinId: twin.id, signal: 'focus_finished', hour: 10, duration: 55, quality: 4, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 14, 10) },
      { userId: user.id, twinId: twin.id, signal: 'task_deferred', hour: 16, duration: 15, quality: 2, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 9, 16) },
      { userId: user.id, twinId: twin.id, signal: 'focus_started', hour: 9, duration: 50, quality: 4, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 4, 9) },
      { userId: user.id, twinId: twin.id, signal: 'task_completed', hour: 10, duration: 45, quality: 5, metadata: { source: 'synthetic_audit' }, occurredAt: agoAtHour(now, 1, 10) },
    ] })
    await tx.novoSignalLedger.createMany({ data: buildAuditLedgerSignals({ completedTaskId: completedTask.id, checkinId: checkin.id, nextTaskId: nextTask.id, now }) })
    await tx.twinEvolutionLog.createMany({ data: [
      { twinId: twin.id, userId: user.id, changeType: 'chronotype_updated', description: 'Patrón de foco matutino detectado en varias fechas sintéticas.', prevValue: JSON.stringify({ chronotype: '' }), newValue: JSON.stringify({ chronotype: 'morning_lark' }), createdAt: agoAtHour(now, 18, 10) },
      { twinId: twin.id, userId: user.id, changeType: 'peak_window_detected', description: 'Ventana de enfoque entre 09:00 y 11:30.', prevValue: JSON.stringify({ peakFocusStart: '' }), newValue: JSON.stringify({ peakFocusStart: '09:00', peakFocusEnd: '11:30' }), createdAt: agoAtHour(now, 12, 10) },
      { twinId: twin.id, userId: user.id, changeType: 'context_switching_detected', description: 'Cambios de contexto asociados con una sesión diferida.', prevValue: JSON.stringify({ mainFrictionPoint: '' }), newValue: JSON.stringify({ mainFrictionPoint: 'context_switching' }), createdAt: agoAtHour(now, 7, 16) },
      { twinId: twin.id, userId: user.id, changeType: 'adaptation_policy_updated', description: 'La política conserva propuestas acotadas y verificables.', prevValue: JSON.stringify({ proposals: [] }), newValue: JSON.stringify({ proposals: ['respect_peak_window', 'reduce_context_switching', 'use_validated_pattern'] }), createdAt: agoAtHour(now, 1, 11) },
    ] })
    await tx.twinSnapshot.createMany({ data: [
      { twinId: twin.id, userId: user.id, confidenceScore: 42, trustLevel: 'learning', cognitiveLoad: 58, burnoutIndex: 28, chronotype: 'intermediate', mainFrictionPoint: 'context_switching', peakFocusStart: '09:00', peakFocusEnd: '11:00', totalSignals: 2, snapshotDate: agoAtHour(now, 20, 12) },
      { twinId: twin.id, userId: user.id, confidenceScore: 58, trustLevel: 'adapted', cognitiveLoad: 49, burnoutIndex: 22, chronotype: 'morning_lark', mainFrictionPoint: 'context_switching', peakFocusStart: '09:00', peakFocusEnd: '11:30', totalSignals: 4, snapshotDate: agoAtHour(now, 10, 12) },
      { twinId: twin.id, userId: user.id, confidenceScore: 74, trustLevel: 'adapted', cognitiveLoad: 43, burnoutIndex: 18, chronotype: 'morning_lark', mainFrictionPoint: 'context_switching', peakFocusStart: '09:00', peakFocusEnd: '11:30', totalSignals: 6, snapshotDate: agoAtHour(now, 1, 12) },
    ] })
    const priorPlan = await tx.actionPlan.create({ data: { userId: user.id, goalId: goal.id, stateSnapshotId: checkin.id, planningDate: agoAtHour(now, 2, 9), timezone: 'America/La_Paz', status: 'completed', reasoningSummary: 'Plan previo sintético completado.', inputs: { taskCount: 2, source: 'synthetic_audit' }, algorithmVersion: 'audit-phase1', generatedBy: 'deterministic' } })
    const priorRecommendation = await tx.recommendedAction.create({ data: { planId: priorPlan.id, userId: user.id, taskId: completedTask.id, title: 'Cerrar el esquema', nextStep: 'Revisar los tres encabezados.', priority: 1, estimatedMinutes: 25, confidence: 0.71, explanation: 'La tarea estaba lista para una sesión corta.', facts: ['Tarea: esquema pendiente.'], inferences: ['Una revisión corta facilitaría el cierre.'], status: 'completed', responseNote: 'Completada durante la mañana.', responseAt: agoAtHour(now, 2, 10), statusAt: agoAtHour(now, 2, 10), startedAt: agoAtHour(now, 2, 9), completedAt: agoAtHour(now, 2, 10), terminalReason: 'completed', lastActor: 'user' } })
    await tx.outcomeEvent.create({ data: { userId: user.id, planId: priorPlan.id, recommendedActionId: priorRecommendation.id, type: 'helpful', metadata: { source: 'synthetic_audit', note: 'La persona reportó que fue útil.' }, idempotencyKey: 'audit-phase1-prior-outcome', createdAt: agoAtHour(now, 2, 11) } })
    const currentPlan = await tx.actionPlan.create({ data: { userId: user.id, goalId: goal.id, stateSnapshotId: checkin.id, planningDate: agoAtHour(now, 0, 9), timezone: 'America/La_Paz', status: 'active', reasoningSummary: 'Plan actual sintético con evidencia separada.', inputs: { checkin: { energy: 4, availableMinutes: 50 }, source: 'synthetic_audit' }, algorithmVersion: 'audit-phase1', generatedBy: 'deterministic' } })
    const currentEvidence = buildCurrentRecommendationEvidence()
    await tx.recommendedAction.create({ data: { planId: currentPlan.id, userId: user.id, taskId: nextTask.id, title: 'Redactar el impacto del caso', nextStep: 'Escribir tres resultados medibles en 25 minutos.', priority: 1, estimatedMinutes: 25, confidence: 0.78, explanation: 'La recomendación prioriza una tarea existente dentro de la ventana observada.', facts: currentEvidence.facts, inferences: currentEvidence.inferences, status: 'proposed', statusAt: agoAtHour(now, 0, 9), lastActor: 'system' } })

    const twinRunId = randomUUID()
    const loopRunId = randomUUID()
    const twinStages = [
      { phase: 'retrieving_context', label: 'Subagente de observación', detail: 'Reuniendo señales recientes y contexto operativo.', sourceCount: 6 },
      { phase: 'interpreting_signals', label: 'Subagente de comprensión', detail: 'Separando hechos observados de inferencias del Twin.', sourceCount: 4 },
      { phase: 'prioritizing', label: 'Subagente de propuesta', detail: 'Evaluando restricciones y cambios posibles.' },
      { phase: 'verifying_result', label: 'Subagente de verificación', detail: 'Comprobando que el cambio esté respaldado por evidencia.' },
      { phase: 'learning', label: 'Subagente de aprendizaje', detail: 'Persistiendo la evolución y su nivel de confianza.' },
      { phase: 'adapting', label: 'Subagente de adaptación', detail: 'Preparando el siguiente comportamiento del Twin.' },
      { phase: 'completed', label: 'Proceso completado', detail: 'Inferencia sintética disponible para revisión.' },
    ]
    const loopStages = [
      { phase: 'retrieving_context', label: 'Recuperando tu contexto', detail: 'Consultando objetivo, estado y tareas.' },
      { phase: 'interpreting_signals', label: 'Revisando señales recientes', detail: 'Separando evidencia sintética de inferencias.' },
      { phase: 'prioritizing', label: 'Evaluando prioridades', detail: 'Aplicando reglas deterministas.' },
      { phase: 'planning', label: 'Preparando tu siguiente acción', detail: 'Guardando una recomendación explicable.' },
      { phase: 'verifying_result', label: 'Verificando el resultado', detail: 'Comprobando que el plan y la recomendación quedaron guardados.' },
      { phase: 'completed', label: 'Proceso completado', detail: 'Plan sintético guardado.' },
    ]
    const twinSchedule = buildAuditActivitySchedule({ now, runId: twinRunId, stageCount: twinStages.length })
    const loopSchedule = buildAuditActivitySchedule({ now, runId: loopRunId, stageCount: loopStages.length })
    await tx.aiActivityRun.create({ data: { id: twinRunId, userId: user.id, surface: 'twin_inference', phase: 'completed', sequence: twinStages.length, status: 'completed', startedAt: twinSchedule.startedAt, completedAt: twinSchedule.completedAt, expiresAt: twinSchedule.expiresAt, resultRef: twin.id, resultSummary: 'Inferencia sintética completada.' } })
    await tx.aiActivityRun.create({ data: { id: loopRunId, userId: user.id, surface: 'novo_loop', phase: 'completed', sequence: loopStages.length, status: 'completed', startedAt: loopSchedule.startedAt, completedAt: loopSchedule.completedAt, expiresAt: loopSchedule.expiresAt, resultRef: currentPlan.id, resultSummary: 'Plan sintético completado.' } })
    await tx.aiActivityEvent.createMany({ data: [...buildActivityEvents(twinRunId, twinStages, twinSchedule), ...buildActivityEvents(loopRunId, loopStages, loopSchedule)] })

    const messages = [
      { id: 'audit-phase1-chat-user', role: 'user', content: '¿Cuál es mi siguiente paso para el portafolio?', timestamp: agoAtHour(now, 0, 9).toISOString() },
      { id: 'audit-phase1-chat-assistant', role: 'assistant', content: 'Reserva 25 minutos para redactar tres resultados medibles del caso de estudio.', timestamp: agoAtHour(now, 0, 9).toISOString(), model: 'synthetic-audit', intent: 'planning' },
    ]
    await tx.aIConversation.create({ data: { userId: user.id, title: 'Revisión sintética del portafolio', messages, createdAt: agoAtHour(now, 0, 9), updatedAt: agoAtHour(now, 0, 9) } })
    await tx.chatSession.create({ data: { userId: user.id, title: 'Revisión sintética del portafolio', messages: JSON.stringify(messages), createdAt: agoAtHour(now, 0, 9), updatedAt: agoAtHour(now, 0, 9) } })

    const [users, settings, profiles, twins, goals, projects, tasks, checkins, behavioralSignals, ledgerSignals, evolutionLogs, snapshots, plans, recommendations, outcomes, activityRuns, activityEventCount, aiConversations, chatSessions] = await Promise.all([
      tx.user.count({ where: { id: user.id } }), tx.userSettings.count({ where: { userId: user.id } }), tx.cognitiveProfile.count({ where: { userId: user.id } }), tx.cognitiveTwinRecord.count({ where: { userId: user.id } }), tx.goal.count({ where: { userId: user.id } }), tx.project.count({ where: { userId: user.id } }), tx.task.count({ where: { userId: user.id } }), tx.cognitiveStateSnapshot.count({ where: { userId: user.id } }), tx.behavioralSignal.count({ where: { userId: user.id } }), tx.novoSignalLedger.count({ where: { userId: user.id } }), tx.twinEvolutionLog.count({ where: { userId: user.id } }), tx.twinSnapshot.count({ where: { userId: user.id } }), tx.actionPlan.count({ where: { userId: user.id } }), tx.recommendedAction.count({ where: { userId: user.id } }), tx.outcomeEvent.count({ where: { userId: user.id } }), tx.aiActivityRun.count({ where: { userId: user.id } }), tx.aiActivityEvent.count({ where: { runId: { in: [twinRunId, loopRunId] } } }), tx.aIConversation.count({ where: { userId: user.id } }), tx.chatSession.count({ where: { userId: user.id } }),
    ])
    return { users, settings, profiles, twins, goals, projects, tasks, checkins, behavioralSignals, ledgerSignals, evolutionLogs, snapshots, plans, recommendations, outcomes, activityRuns, activityEvents: activityEventCount, aiConversations, chatSessions }
  }, { timeout: 60_000, maxWait: 10_000 })
}

export async function runAuditSeed(env = process.env) {
  assertSafeEnvironment(env)
  const [{ PrismaClient }, bcrypt] = await Promise.all([import('@prisma/client'), import('bcrypt')])
  const prisma = new PrismaClient()
  try {
    const passwordHash = await bcrypt.hash(env.NOVO_AUDIT_SEED_PASSWORD, 12)
    return await replaceAuditUser({ prisma, passwordHash, now: new Date() })
  } finally {
    await prisma.$disconnect()
  }
}

export async function runFromCli({ argv = process.argv.slice(2), env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    if (argv.length === 1 && argv[0] === '--check') {
      assertSafeEnvironment(env)
      stdout.write('AUDIT_PHASE1_SAFE_GATE_OK\n')
      return 0
    }
    const counts = await runAuditSeed(env)
    stdout.write(`${formatSeedSummary(counts)}\n`)
    return 0
  } catch {
    stderr.write('AUDIT_PHASE1_SEED_FAILED safe_gate_or_seed_failure\n')
    return 1
  }
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (invokedDirectly) {
  runFromCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
