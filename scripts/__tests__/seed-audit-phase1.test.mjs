import assert from 'node:assert/strict'
import test from 'node:test'

const moduleUrl = new URL('../seed-audit-phase1.mjs', import.meta.url)

const loadSeed = () => import(`${moduleUrl.href}?test=${Date.now()}-${Math.random()}`)

const safeEnvironment = (overrides = {}) => ({
  NODE_ENV: 'test',
  NOVO_ISOLATED_E2E: 'true',
  DATABASE_URL_TEST: 'postgresql://test-user:test-pass@test-db.local/audit_e2e?sslmode=require',
  DATABASE_URL: 'postgresql://test-user:test-pass@test-db.local/audit_e2e?sslmode=require',
  DATABASE_URL_PRODUCTION: 'postgresql://prod-user:prod-pass@prod-db.local:5432/novo',
  DATABASE_TEST_BRANCH: 'novo-e2e-test-visual-audit',
  NOVO_AUDIT_SEED_PASSWORD: 'synthetic-only-password',
  ...overrides,
})

test('rechaza ejecutar el seed fuera del entorno aislado de pruebas', async () => {
  const { assertSafeEnvironment } = await loadSeed()

  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ NODE_ENV: 'development' })),
    /NODE_ENV=test/,
  )
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ NOVO_ISOLATED_E2E: 'false' })),
    /NOVO_ISOLATED_E2E=true/,
  )
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ DATABASE_TEST_BRANCH: 'preview-123' })),
    /DATABASE_TEST_BRANCH/,
  )
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ VERCEL_ENV: 'production' })),
    /VERCEL_ENV=production/,
  )
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ DATABASE_URL: 'postgresql://test-user:test-pass@other-db.local/audit_e2e' })),
    /DATABASE_URL must equal DATABASE_URL_TEST/,
  )
})

test('acepta marcadores de rama separados y rechaza falsos positivos embebidos', async () => {
  const { assertSafeEnvironment } = await loadSeed()

  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ DATABASE_TEST_BRANCH: 'latest' })),
    /DATABASE_TEST_BRANCH/,
  )
  assert.doesNotThrow(() => assertSafeEnvironment(safeEnvironment({ DATABASE_TEST_BRANCH: 'novo-e2e-test-visual-audit' })))
})

test('rechaza URL de prueba que apunta a la misma identidad PostgreSQL que producción', async () => {
  const { assertSafeEnvironment, normalizePostgresIdentity } = await loadSeed()
  const production = 'postgresql://prod-user:one-secret@shared-db.local/novo?sslmode=require'
  const testUrl = 'postgresql://test-user:another-secret@shared-db.local:5432/novo?connect_timeout=5'

  assert.deepEqual(normalizePostgresIdentity(testUrl), {
    host: 'shared-db.local',
    port: '5432',
    database: 'novo',
  })
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ DATABASE_URL: testUrl, DATABASE_URL_TEST: testUrl, DATABASE_URL_PRODUCTION: production })),
    /must not overlap/,
  )
})

test('exige una contraseña sintética de al menos doce caracteres sin aceptar un valor faltante', async () => {
  const { assertSafeEnvironment } = await loadSeed()

  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ NOVO_AUDIT_SEED_PASSWORD: 'short-pass' })),
    /NOVO_AUDIT_SEED_PASSWORD/,
  )
  assert.throws(
    () => assertSafeEnvironment(safeEnvironment({ NOVO_AUDIT_SEED_PASSWORD: undefined })),
    /NOVO_AUDIT_SEED_PASSWORD/,
  )
})

test('la salida de éxito solo contiene el marcador sintético, identidad reservada y conteos', async () => {
  const { formatSeedSummary, RESERVED_AUDIT_EMAIL, RESERVED_AUDIT_USER_ID } = await loadSeed()
  const output = formatSeedSummary({
    users: 1,
    settings: 1,
    profiles: 1,
    twins: 1,
    goals: 1,
    projects: 1,
    tasks: 2,
    checkins: 1,
    behavioralSignals: 6,
    ledgerSignals: 4,
    evolutionLogs: 4,
    snapshots: 3,
    plans: 2,
    recommendations: 2,
    outcomes: 1,
    activityRuns: 2,
    activityEvents: 13,
    aiConversations: 1,
    chatSessions: 1,
    password: 'synthetic-only-password',
    hash: '$2b$12$secret-hash',
    databaseUrl: 'postgresql://user:password@db.local/novo',
    token: 'do-not-print',
  })

  assert.equal(output, `AUDIT_PHASE1_SEED synthetic user=${RESERVED_AUDIT_USER_ID} email=${RESERVED_AUDIT_EMAIL} users=1 settings=1 profiles=1 twins=1 goals=1 projects=1 tasks=2 checkins=1 behavioralSignals=6 ledgerSignals=4 evolutionLogs=4 snapshots=3 plans=2 recommendations=2 outcomes=1 activityRuns=2 activityEvents=13 aiConversations=1 chatSessions=1`)
  assert.doesNotMatch(output, /password|hash|postgresql|token|secret/i)
})

test('la recomendación sintética conserva hechos e inferencias como listas de texto consumibles por el grafo', async () => {
  const { buildCurrentRecommendationEvidence } = await loadSeed()
  const evidence = buildCurrentRecommendationEvidence()

  assert.deepEqual(evidence.facts, ['Check-in: energía 4/5 y 50 minutos disponibles.', 'Tarea prioritaria en progreso.'])
  assert.deepEqual(evidence.inferences, ['La mañana probablemente reduce la fricción de contexto.'])
  assert.ok([...evidence.facts, ...evidence.inferences].every((item) => typeof item === 'string'))
})

test('las señales activas comparten tokens con los patrones y conserva una señal excluida distinta', async () => {
  const { buildAuditLedgerSignals } = await loadSeed()
  const signals = buildAuditLedgerSignals({ completedTaskId: 'task-done', checkinId: 'checkin-1', nextTaskId: 'task-next', now: new Date('2026-08-09T12:00:00.000Z') })

  assert.deepEqual(signals.filter((signal) => !signal.excludedAt).map((signal) => signal.signalType), ['peak_window_observation', 'chronotype_observation', 'context_switching_observation'])
  assert.equal(signals.find((signal) => signal.excludedAt)?.signalType, 'schedule_exception')
})

test('las trece etapas Activity están ordenadas dentro de la vida de cada run', async () => {
  const { buildAuditActivitySchedule } = await loadSeed()
  const now = new Date('2026-08-09T12:00:00.000Z')
  const schedule = buildAuditActivitySchedule({ now, runId: 'run-1', stageCount: 7 })

  assert.equal(schedule.events.length, 7)
  assert.equal(schedule.events[0].sequence, 1)
  assert.equal(schedule.events.at(-1).sequence, 7)
  assert.ok(schedule.events.every((event) => event.timestamp >= schedule.startedAt && event.timestamp <= schedule.completedAt))
  assert.ok(schedule.expiresAt > schedule.completedAt)
})

test('construye eventos Activity sin colisionar con el conteo activityEvents del resumen', async () => {
  const { buildActivityEvents, buildAuditActivitySchedule } = await loadSeed()
  const schedule = buildAuditActivitySchedule({ now: new Date('2026-08-09T12:00:00.000Z'), runId: 'run-1', stageCount: 2 })
  const events = buildActivityEvents('run-1', [
    { phase: 'retrieving_context', label: 'Recuperando contexto', detail: 'Datos sintéticos.' },
    { phase: 'completed', label: 'Proceso completado', detail: 'Resultado sintético.' },
  ], schedule)

  assert.equal(events.length, 2)
  assert.equal(events[1].terminal, true)
  assert.equal(events[0].sequence, 1)
})

test('el modo check valida únicamente el gate y emite su marcador exacto', async () => {
  const { runFromCli } = await loadSeed()
  const output = []
  const errors = []

  const exitCode = await runFromCli({
    argv: ['--check'],
    env: safeEnvironment(),
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => errors.push(value) },
  })

  assert.equal(exitCode, 0)
  assert.deepEqual(output, ['AUDIT_PHASE1_SAFE_GATE_OK\n'])
  assert.deepEqual(errors, [])
})

test('el modo check falla con el mensaje genérico sin revelar el entorno', async () => {
  const { runFromCli } = await loadSeed()
  const output = []
  const errors = []

  const exitCode = await runFromCli({
    argv: ['--check'],
    env: safeEnvironment({ NODE_ENV: 'development' }),
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => errors.push(value) },
  })

  assert.equal(exitCode, 1)
  assert.deepEqual(output, [])
  assert.deepEqual(errors, ['AUDIT_PHASE1_SEED_FAILED safe_gate_or_seed_failure\n'])
})
