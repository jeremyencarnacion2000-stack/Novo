import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { appendActivityEvent, createActivityRun, finishActivityRun, getActivityRun } from '@/lib/ai/activity'
import { POST as generatePlan } from '@/app/api/cognitive/loop/plan/route'
import { GET as getPlan } from '@/app/api/cognitive/loop/plan/route'
import { POST as submitCheckin } from '@/app/api/cognitive/loop/checkin/route'
import { POST as respondToAction } from '@/app/api/cognitive/loop/response/route'
import { POST as updateSignal } from '@/app/api/cognitive/loop/signals/route'
import { POST as proposeCalendarBlock } from '@/app/api/cognitive/loop/calendar/route'
import { GET as getActivityRuns } from '@/app/api/ai/activity/runs/route'
import { GET as pollActivityRun, POST as updateActivityRun } from '@/app/api/ai/activity/runs/[runId]/route'
import { GET as streamActivityRun } from '@/app/api/ai/activity/runs/[runId]/stream/route'
import { DELETE as revokeMcpToken } from '@/app/api/mcp/tokens/[tokenId]/route'
import { issueMcpPersonalAccessToken, validateMcpPersonalAccessToken } from '@/lib/mcp/personal-access-token'
import { POST as callMcp } from '@/app/api/mcp/route'

const session = getServerSession as jest.Mock
jest.setTimeout(60_000)

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mcpRequest(token: string, body: unknown) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function mcpResult(token: string, id: number, method: string, params: Record<string, unknown>) {
  const response = await callMcp(mcpRequest(token, { jsonrpc: '2.0', id, method, params }))
  const body = await response.text()
  const data = body.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim() ?? body
  return { response, payload: JSON.parse(data) }
}

describe('Novo Loop isolated database E2E', () => {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const createdUserIds: string[] = []
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }

  beforeAll(async () => {
    const { assertIsolatedE2EEnvironment } = await import('../scripts/validate-isolated-e2e-environment.mjs')
    assertIsolatedE2EEnvironment({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL_PRODUCTION ?? process.env.DATABASE_URL,
    })
    userA = (await prisma.user.create({ data: { email: `novo-e2e-a-${suffix}@test.invalid`, name: 'Synthetic User A' }, select: { id: true, email: true } }))
    createdUserIds.push(userA.id)
    userB = (await prisma.user.create({ data: { email: `novo-e2e-b-${suffix}@test.invalid`, name: 'Synthetic User B' }, select: { id: true, email: true } }))
    createdUserIds.push(userB.id)
  })

  afterAll(async () => {
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await prisma.$disconnect()
  })

  it('proves objective → check-in → plan → lifecycle → feedback → adapted plan', async () => {
    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
    const goal = await prisma.goal.create({ data: { userId: userA.id, title: 'Synthetic launch objective', status: 'active', priority: 'high', deadline: '2030-08-17' } })
    await prisma.cognitiveTwinRecord.create({ data: {
      userId: userA.id,
      isInitialized: true,
      trustLevel: 'validated',
      identity: { adaptationPolicy: { proposals: [{ id: 'use_validated_pattern', reason: 'Synthetic QA pattern already validated.', behavior: 'Use only validated patterns as recommendation context.' }] } },
    } })
    const checkinResponse = await submitCheckin(request('/api/cognitive/loop/checkin', {
      energy: 4,
      focus: 4,
      workload: 2,
      availableMinutes: 45,
      currentContext: 'synthetic-e2e',
      timezone: 'America/La_Paz',
    }))
    expect(checkinResponse.status).toBe(200)
    const { snapshot } = await checkinResponse.json()
    expect(snapshot).toMatchObject({ userId: userA.id, energy: 4, focus: 4, workload: 2, availableMinutes: 45, currentContext: 'synthetic-e2e' })
    const task = await prisma.task.create({ data: { userId: userA.id, title: 'Synthetic payment review', status: 'todo', priority: 'high', tags: '[]', dueDate: '2030-08-17' } })

    const planResponse = await generatePlan(request('/api/cognitive/loop/plan', { goalId: goal.id, snapshotId: snapshot.id, timezone: 'America/La_Paz' }))
    expect(planResponse.status).toBe(201)
    const planPayload = await planResponse.json()
    const action = planPayload.plan.actions[0]
    expect(action.taskId).toBe(task.id)
    expect(planPayload.runId).toEqual(expect.any(String))
    const activity = await prisma.aiActivityRun.findUnique({ where: { id: planPayload.runId }, include: { events: { orderBy: { sequence: 'asc' } } } })
    expect(activity?.userId).toBe(userA.id)
    expect(activity?.events.map((event) => event.phase)).toEqual(expect.arrayContaining(['retrieving_context', 'interpreting_signals', 'prioritizing', 'planning', 'completed']))

    const planningSignals = await prisma.novoSignalLedger.findMany({ where: { userId: userA.id } })
    expect(planningSignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'goal', sourceRef: goal.id, signalType: 'active_objective' }),
      expect.objectContaining({ source: 'checkin', sourceRef: snapshot.id, signalType: 'operating_state', reliability: 'user_reported' }),
      expect.objectContaining({ source: 'task', sourceRef: task.id, signalType: 'unfinished_task' }),
    ]))
    expect(action.inferences.join(' ')).toContain('current self-reported state')
    expect(action.inferences.join(' ')).toContain('previously validated Twin pattern')

    const taskSignal = planningSignals.find((signal) => signal.source === 'task' && signal.sourceRef === task.id && signal.signalType === 'unfinished_task')
    expect(taskSignal).toBeDefined()
    const correctedTitle = 'Synthetic corrected payment review'
    const correctionResponse = await updateSignal(request('/api/cognitive/loop/signals', { signalId: taskSignal!.id, action: 'correct', correction: correctedTitle }))
    expect(correctionResponse.status).toBe(200)
    expect((await prisma.novoSignalLedger.findUniqueOrThrow({ where: { id: taskSignal!.id } }))).toMatchObject({ correction: correctedTitle, correctedAt: expect.any(Date) })

    const correctedPlanResponse = await generatePlan(request('/api/cognitive/loop/plan', { goalId: goal.id, snapshotId: snapshot.id, timezone: 'America/La_Paz' }))
    expect(correctedPlanResponse.status).toBe(201)
    const correctedPlanPayload = await correctedPlanResponse.json()
    const correctedAction = correctedPlanPayload.plan.actions[0]
    expect(correctedAction).toMatchObject({ taskId: task.id, title: correctedTitle })
    expect(correctedAction.title).not.toBe(action.title)

    const transition = async (response: string, note?: string) => {
      const result = await respondToAction(request('/api/cognitive/loop/response', { actionId: correctedAction.id, response, note, idempotencyKey: randomUUID() }))
      expect(result.status).toBe(200)
      return result.json()
    }
    const accepted = await transition('accepted')
    expect(accepted.action.status).toBe('accepted')
    const started = await transition('started')
    expect(started.action.status).toBe('started')
    const completed = await transition('completed')
    expect(completed.action.status).toBe('completed')
    const completedAt = new Date()
    await prisma.recommendedAction.update({ where: { id: correctedAction.id }, data: { startedAt: new Date(completedAt.getTime() - 20 * 60_000), completedAt } })
    const helpful = await transition('helpful', 'Synthetic positive feedback')
    expect(helpful.action.status).toBe('completed')
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('done')
    const verificationRun = await getActivityRun(userA.id, completed.runId)
    expect(verificationRun?.events.map((event) => event.phase)).toEqual(expect.arrayContaining(['verifying_result', 'learning', 'completed']))
    const learningRun = await getActivityRun(userA.id, helpful.runId)
    expect(learningRun?.events.map((event) => event.phase)).toEqual(expect.arrayContaining(['composing_response', 'learning', 'completed']))
    expect((await prisma.outcomeEvent.findMany({ where: { userId: userA.id, recommendedActionId: correctedAction.id }, orderBy: { createdAt: 'asc' } })).map((outcome) => outcome.type)).toEqual(['accepted', 'started', 'completed', 'helpful'])
    const followUpTask = await prisma.task.create({ data: { userId: userA.id, title: 'Synthetic follow-up review', status: 'todo', priority: 'high', tags: '[]', dueDate: '2030-08-18' } })

    const nextPlanResponse = await generatePlan(request('/api/cognitive/loop/plan', { goalId: goal.id, snapshotId: snapshot.id, timezone: 'America/La_Paz' }))
    expect(nextPlanResponse.status).toBe(201)
    const nextPlan = await nextPlanResponse.json()
    expect(nextPlan.plan.actions[0].taskId).toBe(followUpTask.id)
    expect(nextPlan.plan.actions[0].estimatedMinutes).toBe(20)
    expect(nextPlan.plan.actions[0].estimatedMinutes).not.toBe(correctedAction.estimatedMinutes)
    expect(nextPlan.plan.actions[0].inferences.join(' ')).toContain('Previous completed steps suggest a 20-minute working block')

    const recovered = await getActivityRun(userA.id, planPayload.runId, 1)
    expect(recovered?.events.every((event) => event.sequence > 1)).toBe(true)

    session.mockResolvedValue({ user: { id: userB.id, email: userB.email } })
    const userBPlan = await getPlan()
    expect(userBPlan.status).toBe(200)
    expect((await userBPlan.json()).plan).toBeNull()
    expect(await prisma.recommendedAction.count({ where: { userId: userB.id } })).toBe(0)
    expect(await getActivityRun(userB.id, planPayload.runId)).toBeNull()
    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
  })

  it('enforces ownership, ordering, duplicate delivery and Calendar idempotency', async () => {
    const run = await createActivityRun(userA.id, 'novo_loop')
    const recoveredAfterReload = await getActivityRuns()
    expect(recoveredAfterReload.status).toBe(200)
    expect((await recoveredAfterReload.json()).run.id).toBe(run.id)
    session.mockResolvedValue({ user: { id: userB.id, email: userB.email } })
    const hiddenFromB = await getActivityRuns()
    expect((await hiddenFromB.json()).run).toBeNull()
    const foreignTelemetry = await updateActivityRun(
      request(`/api/ai/activity/runs/${run.id}`, { action: 'telemetry', event: 'retry' }),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(foreignTelemetry.status).toBe(404)
    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
    const first = await appendActivityEvent(userA.id, { runId: run.id, phase: 'retrieving_context', label: 'Synthetic context', sequence: 1 })
    const outOfOrder = await appendActivityEvent(userA.id, { runId: run.id, phase: 'planning', label: 'Out of order', sequence: 3 })
    const duplicate = await appendActivityEvent(userA.id, { runId: run.id, phase: 'planning', label: 'Duplicate', sequence: 3 })
    expect(first?.sequence).toBe(1)
    expect(outOfOrder?.sequence).toBe(3)
    expect(duplicate).toBeNull()
    expect(await getActivityRun(userB.id, run.id)).toBeNull()
    expect((await getActivityRun(userA.id, run.id, 99))?.events).toHaveLength(0)

    const disconnectedStreamController = new AbortController()
    const disconnectedStreamResponse = await streamActivityRun(
      new NextRequest(`http://localhost/api/ai/activity/runs/${run.id}/stream?after=3`, { signal: disconnectedStreamController.signal }),
      { params: Promise.resolve({ runId: run.id }) },
    )
    disconnectedStreamController.abort('synthetic transient transport failure')
    const disconnectedPayload = await disconnectedStreamResponse.text()
    expect(disconnectedPayload).not.toContain('"status":"completed"')

    const pollingFallbackTelemetry = await updateActivityRun(
      request(`/api/ai/activity/runs/${run.id}`, { action: 'telemetry', event: 'polling_fallback' }),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(pollingFallbackTelemetry.status).toBe(200)
    const retryTelemetry = await updateActivityRun(
      request(`/api/ai/activity/runs/${run.id}`, { action: 'telemetry', event: 'retry' }),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(retryTelemetry.status).toBe(200)
    expect(await prisma.analyticsEvent.count({ where: { userId: userA.id, eventType: 'ai_polling_fallback', eventData: { contains: run.id } } })).toBe(1)
    expect(await prisma.analyticsEvent.count({ where: { userId: userA.id, eventType: 'ai_run_retry', eventData: { contains: run.id } } })).toBe(1)

    const completedAfterTransientFailure = await finishActivityRun(userA.id, run.id, 'completed', { resultSummary: 'synthetic recovery reached a consistent final state' })
    expect(completedAfterTransientFailure?.status).toBe('completed')
    const polledResponse = await pollActivityRun(
      new NextRequest(`http://localhost/api/ai/activity/runs/${run.id}?after=1`),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(polledResponse.status).toBe(200)
    const polled = await polledResponse.json()
    expect(polled.run).toMatchObject({ id: run.id, status: 'completed', phase: 'completed' })
    expect(polled.events.at(-1)).toMatchObject({ phase: 'completed', terminal: true })
    const reconnectedTelemetry = await updateActivityRun(
      request(`/api/ai/activity/runs/${run.id}`, { action: 'telemetry', event: 'reconnected' }),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(reconnectedTelemetry.status).toBe(200)
    const streamResponse = await streamActivityRun(
      new NextRequest(`http://localhost/api/ai/activity/runs/${run.id}/stream?after=1`),
      { params: Promise.resolve({ runId: run.id }) },
    )
    expect(streamResponse.headers.get('content-type')).toContain('text/event-stream')
    const streamPayloads = (await streamResponse.text()).split(/\r?\n/).filter((line) => line.startsWith('data: ')).map((line) => line.slice(6))
    expect(streamPayloads.some((payload) => payload.includes('"phase":"completed"'))).toBe(true)
    expect(streamPayloads.some((payload) => payload.includes('"status":"completed"'))).toBe(true)
    expect(streamPayloads.at(-1)).toBe('"[DONE]"')
    expect(await prisma.analyticsEvent.count({ where: { userId: userA.id, eventType: 'ai_run_reconnected', eventData: { contains: run.id } } })).toBe(1)

    const cancelledRun = await createActivityRun(userA.id, 'novo_loop')
    const cancelled = await finishActivityRun(userA.id, cancelledRun.id, 'cancelled', { errorCode: 'synthetic_cancel' })
    expect(cancelled?.status).toBe('cancelled')
    const repeatedCancel = await finishActivityRun(userA.id, cancelledRun.id, 'cancelled', { errorCode: 'synthetic_cancel' })
    expect(repeatedCancel?.status).toBe('cancelled')
    expect((await getActivityRun(userA.id, cancelledRun.id))?.events).toHaveLength(1)
    const retryRun = await createActivityRun(userA.id, 'novo_loop')
    const retried = await finishActivityRun(userA.id, retryRun.id, 'completed', { resultSummary: 'synthetic retry succeeded' })
    expect(retried?.status).toBe('completed')

    session.mockResolvedValue({ user: { id: userB.id, email: userB.email } })
    const forbidden = await getPlan()
    expect(forbidden.status).toBe(200)
    expect((await forbidden.json()).plan).toBeNull()

    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
    const action = await prisma.recommendedAction.findFirstOrThrow({ where: { userId: userA.id, status: 'completed' }, orderBy: { createdAt: 'desc' } })
    const idempotencyKey = randomUUID()
    const start = new Date(Date.now() + 60_000)
    const end = new Date(start.getTime() + 30 * 60_000)
    const execution = await prisma.externalActionExecution.create({ data: { userId: userA.id, recommendedActionId: action.id, provider: 'google_calendar', operation: 'create_focus_block', idempotencyKey, requestFingerprint: 'synthetic', status: 'succeeded', externalResourceId: 'synthetic-google-event' } })
    await prisma.calendarEvent.create({ data: { userId: userA.id, title: action.title, start, end, source: 'ai', googleEventId: execution.externalResourceId } })
    const duplicateCalendarResponses = await Promise.all([
      proposeCalendarBlock(request('/api/cognitive/loop/calendar', { actionId: action.id, start: start.toISOString(), end: end.toISOString(), idempotencyKey })),
      proposeCalendarBlock(request('/api/cognitive/loop/calendar', { actionId: action.id, start: start.toISOString(), end: end.toISOString(), idempotencyKey })),
    ])
    expect(duplicateCalendarResponses.every((response) => response.status === 200)).toBe(true)
    expect((await duplicateCalendarResponses[0].json()).duplicate).toBe(true)
    expect(await prisma.externalActionExecution.count({ where: { userId: userA.id, idempotencyKey } })).toBe(1)
    expect(await prisma.calendarEvent.count({ where: { userId: userA.id, googleEventId: execution.externalResourceId } })).toBe(1)

    session.mockResolvedValue({ user: { id: userB.id, email: userB.email } })
    const crossUser = await respondToAction(request('/api/cognitive/loop/response', { actionId: action.id, response: 'accepted', idempotencyKey: randomUUID() }))
    expect(crossUser.status).toBe(404)
  })

  it('persists an excluded task signal and omits it from the next plan', async () => {
    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
    await prisma.task.updateMany({ where: { userId: userA.id, status: { in: ['todo', 'in-progress'] } }, data: { status: 'done' } })
    const goal = await prisma.goal.create({ data: { userId: userA.id, title: 'Synthetic signal-control objective', status: 'active', priority: 'high' } })
    const snapshotResponse = await submitCheckin(request('/api/cognitive/loop/checkin', {
      energy: 3, focus: 3, workload: 3, availableMinutes: 30, currentContext: 'synthetic signal control', timezone: 'America/La_Paz',
    }))
    expect(snapshotResponse.status).toBe(200)
    const { snapshot } = await snapshotResponse.json()
    const task = await prisma.task.create({ data: { userId: userA.id, title: 'Synthetic excluded task', status: 'todo', priority: 'high', tags: '[]' } })

    const initialPlan = await generatePlan(request('/api/cognitive/loop/plan', { goalId: goal.id, snapshotId: snapshot.id, timezone: 'America/La_Paz' }))
    expect(initialPlan.status).toBe(201)
    expect((await initialPlan.json()).plan.actions[0].taskId).toBe(task.id)

    const signal = await prisma.novoSignalLedger.findFirstOrThrow({ where: { userId: userA.id, source: 'task', sourceRef: task.id, signalType: 'unfinished_task' } })
    const exclusion = await updateSignal(request('/api/cognitive/loop/signals', { signalId: signal.id, action: 'exclude', reason: 'synthetic exclusion' }))
    expect(exclusion.status).toBe(200)
    expect((await prisma.novoSignalLedger.findUniqueOrThrow({ where: { id: signal.id } })).excludedAt).not.toBeNull()

    const nextPlan = await generatePlan(request('/api/cognitive/loop/plan', { goalId: goal.id, snapshotId: snapshot.id, timezone: 'America/La_Paz' }))
    expect(nextPlan.status).toBe(201)
    const nextPayload = await nextPlan.json()
    expect(nextPayload.plan.actions[0].taskId).toBeNull()
    expect(nextPayload.plan.actions[0].title).toContain('Synthetic signal-control objective')
  })

  it('persists only a revocable device-token hash and enforces its owner scopes', async () => {
    const { record, token } = await issueMcpPersonalAccessToken({
      userId: userA.id,
      name: 'Synthetic MCP device',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })
    expect(record.tokenHash).not.toContain(token)
    expect(record.scopes).toEqual(['tasks:read', 'goals:read', 'recommendations:read'])

    const accepted = await validateMcpPersonalAccessToken(token)
    expect(accepted.ok).toBe(true)
    if (accepted.ok) {
      expect(accepted.userId).toBe(userA.id)
      expect(accepted.authInfo.scopes).toEqual(['tasks:read', 'goals:read', 'recommendations:read'])
    }
    expect((await prisma.mcpPersonalAccessToken.findUniqueOrThrow({ where: { id: record.id } })).lastUsedAt).not.toBeNull()

    const userBToken = await issueMcpPersonalAccessToken({
      userId: userB.id,
      name: 'Other user device',
      scopes: ['tasks:read'],
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })
    session.mockResolvedValue({ user: { id: userA.id, email: userA.email } })
    const crossUserRevoke = await revokeMcpToken(new Request('http://localhost/api/mcp/tokens/device-b', { method: 'DELETE' }), { params: Promise.resolve({ tokenId: userBToken.record.id }) })
    expect(crossUserRevoke.status).toBe(404)
    expect((await prisma.mcpPersonalAccessToken.findUniqueOrThrow({ where: { id: userBToken.record.id } })).revokedAt).toBeNull()

    const revokeResponse = await revokeMcpToken(new Request('http://localhost/api/mcp/tokens/device-a', { method: 'DELETE' }), { params: Promise.resolve({ tokenId: record.id }) })
    expect(revokeResponse.status).toBe(204)
    const rejectedAfterRevocation = await validateMcpPersonalAccessToken(token)
    expect(rejectedAfterRevocation.ok).toBe(false)
  })

  it('executes MCP task work with scopes, durable audit and idempotency', async () => {
    await prisma.goal.create({ data: { userId: userB.id, title: 'User B private objective', status: 'active', priority: 'high' } })
    const userAChecklist = await prisma.checklistItem.create({ data: { userId: userA.id, text: 'User A manual checklist task', priority: 'medium', source: 'manual' } })
    const userBChecklist = await prisma.checklistItem.create({ data: { userId: userB.id, text: 'User B private checklist task', priority: 'high', source: 'manual' } })
    const { token: readToken } = await issueMcpPersonalAccessToken({ userId: userA.id, name: 'Synthetic read-only MCP', scopes: [], expiresAt: new Date(Date.now() + 60 * 60_000) })
    const toolList = await mcpResult(readToken, 0, 'tools/list', {})
    expect(toolList.response.status).toBe(200)
    const triggerSyncTool = toolList.payload.result.tools.find((tool: { name: string }) => tool.name === 'trigger_plugin_sync')
    expect(triggerSyncTool.inputSchema.required).toEqual(expect.arrayContaining(['provider', 'idempotencyKey']))
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('update_twin_metrics')
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('run_twin_agent')
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('delete_task')
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('create_calendar_event')
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('create_routine')
    expect(toolList.payload.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('generate_day_plan')
    const objectiveRead = await mcpResult(readToken, 1, 'tools/call', { name: 'read_objectives', arguments: {} })
    expect(objectiveRead.response.status).toBe(200)
    const objectiveText = objectiveRead.payload.result.content.find((item: any) => item.type === 'text').text
    expect(JSON.parse(objectiveText).goals.some((goal: any) => goal.title === 'User B private objective')).toBe(false)
    const pendingRead = await mcpResult(readToken, 20, 'tools/call', { name: 'get_pending_tasks', arguments: {} })
    const pendingText = pendingRead.payload.result.content.find((item: any) => item.type === 'text').text
    const pendingResources = JSON.parse(pendingText).tasks
    expect(pendingResources.some((task: any) => task.title === 'User A manual checklist task' && task.resourceType === 'checklist_item')).toBe(true)
    expect(pendingResources.some((task: any) => task.title === 'User B private checklist task')).toBe(false)

    const deniedWrite = await mcpResult(readToken, 2, 'tools/call', { name: 'create_task', arguments: { title: 'Denied', category: 'Work', priority: 2, idempotencyKey: randomUUID() } })
    expect(deniedWrite.payload.result.isError).toBe(true)
    expect(deniedWrite.payload.result.content[0].text).toContain('tasks:write')

    const { token: writeToken, record: writeRecord } = await issueMcpPersonalAccessToken({ userId: userA.id, name: 'Synthetic write MCP', scopes: ['tasks:write'], expiresAt: new Date(Date.now() + 60 * 60_000) })
    const checklistUpdateKey = randomUUID()
    const checklistUpdate = await mcpResult(writeToken, 21, 'tools/call', {
      name: 'update_checklist_item',
      arguments: { id: `checklist:${userAChecklist.id}`, updates: { completed: true, priority: 3 }, idempotencyKey: checklistUpdateKey },
    })
    expect(checklistUpdate.response.status).toBe(200)
    expect(JSON.parse(checklistUpdate.payload.result.content[0].text)).toMatchObject({ checklistItemId: userAChecklist.id, completed: true, priority: 'high' })
    const duplicateChecklistUpdate = await mcpResult(writeToken, 22, 'tools/call', {
      name: 'update_checklist_item',
      arguments: { id: `checklist:${userAChecklist.id}`, updates: { completed: true, priority: 3 }, idempotencyKey: checklistUpdateKey },
    })
    expect(JSON.parse(duplicateChecklistUpdate.payload.result.content[0].text).duplicate).toBe(true)
    expect(await prisma.checklistItem.findUniqueOrThrow({ where: { id: userAChecklist.id } })).toMatchObject({ completed: true, priority: 'high' })
    const crossUserChecklistUpdate = await mcpResult(writeToken, 23, 'tools/call', {
      name: 'update_checklist_item',
      arguments: { id: `checklist:${userBChecklist.id}`, updates: { completed: true }, idempotencyKey: randomUUID() },
    })
    expect(crossUserChecklistUpdate.payload.result.isError).toBe(true)
    expect((await prisma.checklistItem.findUniqueOrThrow({ where: { id: userBChecklist.id } })).completed).toBe(false)

    const key = randomUUID()
    const createArguments = { title: 'Synthetic MCP implementation task', category: 'Work', priority: 3, idempotencyKey: key }
    const created = await mcpResult(writeToken, 3, 'tools/call', { name: 'create_task', arguments: createArguments })
    const createdText = created.payload.result.content.find((item: any) => item.type === 'text').text
    const createdTask = JSON.parse(createdText)
    const duplicate = await mcpResult(writeToken, 3, 'tools/call', { name: 'create_task', arguments: createArguments })
    expect(JSON.parse(duplicate.payload.result.content[0].text).duplicate).toBe(true)
    expect(await prisma.task.count({ where: { userId: userA.id, title: createArguments.title } })).toBe(1)

    const started = await mcpResult(writeToken, 5, 'tools/call', { name: 'start_task', arguments: { id: createdTask.taskId, idempotencyKey: randomUUID() } })
    expect(JSON.parse(started.payload.result.content[0].text).status).toBe('in-progress')
    await mcpResult(writeToken, 6, 'tools/call', { name: 'complete_task', arguments: { id: createdTask.taskId, idempotencyKey: randomUUID() } })
    expect((await prisma.task.findUniqueOrThrow({ where: { id: createdTask.taskId } })).status).toBe('done')

    const objective = await prisma.goal.findFirstOrThrow({ where: { userId: userA.id }, orderBy: { createdAt: 'asc' } })
    const plan = await prisma.actionPlan.create({ data: { userId: userA.id, goalId: objective.id, planningDate: new Date(), timezone: 'UTC', reasoningSummary: 'Synthetic MCP outcome', inputs: {}, algorithmVersion: 'mcp-e2e' } })
    const recommendation = await prisma.recommendedAction.create({ data: { planId: plan.id, userId: userA.id, taskId: createdTask.taskId, title: createArguments.title, nextStep: 'Complete it', priority: 1, confidence: 0.5, explanation: 'Synthetic', facts: [], inferences: [] } })
    for (const response of ['accepted', 'started', 'completed'] as const) {
      const result = await mcpResult(writeToken, 10 + ['accepted', 'started', 'completed'].indexOf(response), 'tools/call', { name: 'record_recommendation_outcome', arguments: { actionId: recommendation.id, response, idempotencyKey: randomUUID() } })
      expect(result.response.status).toBe(200)
    }
    expect((await prisma.recommendedAction.findUniqueOrThrow({ where: { id: recommendation.id } })).status).toBe('completed')
    expect(await prisma.outcomeEvent.count({ where: { recommendedActionId: recommendation.id, userId: userA.id } })).toBe(3)

    const audit = await prisma.mcpAuditLog.findMany({ where: { userId: userA.id, tokenId: writeRecord.id }, orderBy: { createdAt: 'asc' } })
    expect(audit.some((entry) => entry.tool === 'create_task' && entry.resourceId === createdTask.taskId && entry.resultStatus === 'succeeded')).toBe(true)
    expect(audit.filter((entry) => entry.idempotencyKey === key)).toHaveLength(1)
    expect(audit.every((entry) => !entry.resultSummary?.includes(writeToken))).toBe(true)
    const mcpAnalytics = await prisma.analyticsEvent.findMany({
      where: { userId: userA.id, eventType: { in: ['mcp_tool_invoked', 'mcp_tool_completed'] } },
    })
    expect(mcpAnalytics.some((entry) => entry.eventType === 'mcp_tool_invoked')).toBe(true)
    expect(mcpAnalytics.some((entry) => entry.eventType === 'mcp_tool_completed')).toBe(true)

    const expired = await issueMcpPersonalAccessToken({ userId: userA.id, name: 'Expired MCP', scopes: [], expiresAt: new Date(Date.now() - 1_000) })
    const expiredResponse = await callMcp(mcpRequest(expired.token, { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} }))
    expect(expiredResponse.status).toBe(401)
    const invalidResponse = await callMcp(mcpRequest('novo_mcp_invalid_device_token', { jsonrpc: '2.0', id: 8, method: 'tools/list', params: {} }))
    expect(invalidResponse.status).toBe(401)
    expect(await prisma.mcpSecurityEvent.count({ where: { eventType: 'authorization_rejected' } })).toBeGreaterThanOrEqual(2)
  })
})
