import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'
import type { NovoActivityEvent, NovoActivityPhase, NovoActivitySurface } from './activity-contract'
export type { NovoActivityEvent, NovoActivityPhase, NovoActivitySurface } from './activity-contract'

const terminalPhases = new Set<NovoActivityPhase>(['completed', 'failed', 'cancelled'])
const safeToolNames = new Set(['google_calendar', 'task_store', 'objective_store', 'context_store', 'groq', 'gemini'])

function safeToolName(value?: string) {
  return value && safeToolNames.has(value) ? value : undefined
}

export async function createActivityRun(userId: string, surface: NovoActivitySurface, id: string = randomUUID()) {
  const now = new Date()
  // Opportunistic compaction keeps the table bounded even when the scheduled
  // cleanup job is delayed. Only expired operational records are removed.
  await prisma.aiActivityRun.deleteMany({ where: { userId, expiresAt: { lt: now } } })
  // The browser keeps the run id across reconnects. If the original response
  // was lost, return the owned run instead of creating a second run or leaking
  // a duplicate-key 500.
  const existing = await prisma.aiActivityRun.findFirst({ where: { id, userId } })
  if (existing) return existing

  try {
    const run = await prisma.aiActivityRun.create({ data: { id, userId, surface, phase: 'initializing', expiresAt: new Date(now.getTime() + 30 * 60_000) } })
    await trackNovoLoopEvent(userId, 'ai_run_started', { runId: run.id, surface })
    return run
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const winner = await prisma.aiActivityRun.findFirst({ where: { id, userId } })
      if (winner) return winner
    }
    throw error
  }
}

export async function appendActivityEvent(userId: string, input: Omit<NovoActivityEvent, 'sequence' | 'timestamp'> & { sequence?: number; timestamp?: Date; detail?: string; toolName?: string }) {
  // Activity producers can race during reconnects, stream retries, and an
  // Inngest delivery that overlaps the browser stream. Serialize the tiny
  // read(sequence) → insert(event) → update(run) window per run so the unique
  // (runId, sequence) invariant is enforced before Postgres has to reject a
  // duplicate frame.
  const event = await withProviderSyncLock(prisma, `activity:${userId}:${input.runId}`, async (tx) => {
    const run = await tx.aiActivityRun.findFirst({ where: { id: input.runId, userId } })
    if (!run) throw new Error('activity_run_not_found')
    if (['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) return null
    const sequence = input.sequence ?? run.sequence + 1
    if (sequence <= run.sequence) return null
    const terminal = input.terminal ?? terminalPhases.has(input.phase)
    const status = terminal ? input.phase : input.phase === 'awaiting_confirmation' ? 'awaiting_confirmation' : 'running'
    const created = await tx.aiActivityEvent.create({ data: {
      id: randomUUID(), runId: run.id, sequence, phase: input.phase, label: input.label,
      detail: input.detail?.slice(0, 240), timestamp: input.timestamp ?? new Date(),
      sourceCount: input.sourceCount, toolName: safeToolName(input.toolName),
      requiresConfirmation: Boolean(input.requiresConfirmation), recoverable: Boolean(input.recoverable), terminal,
    } })
    await tx.aiActivityRun.update({ where: { id: run.id }, data: {
      phase: input.phase, sequence, status, updatedAt: new Date(),
      ...(safeToolName(input.toolName) ? { currentTool: safeToolName(input.toolName) } : {}),
      ...(terminal ? { completedAt: new Date() } : {}),
    } })
    return created
  })
  if (event) {
    if (event.sequence === 1) await trackNovoLoopEvent(userId, 'ai_first_activity_event', { runId: event.runId, phase: event.phase })
    if (event.phase === 'calling_tool') await trackNovoLoopEvent(userId, 'ai_tool_started', { runId: event.runId, toolName: event.toolName ?? null })
    if (event.phase === 'awaiting_confirmation') await trackNovoLoopEvent(userId, 'ai_confirmation_requested', { runId: event.runId, requiresConfirmation: true })
  }
  return event
}

export async function getActivityRun(userId: string, runId: string, after = 0) {
  const run = await prisma.aiActivityRun.findFirst({ where: { id: runId, userId } })
  if (!run) return null
  const events = await prisma.aiActivityEvent.findMany({ where: { runId, sequence: { gt: after } }, orderBy: { sequence: 'asc' }, take: 100 })
  return { run, events }
}

export async function isActivityCancelled(userId: string, runId: string) {
  const run = await prisma.aiActivityRun.findFirst({ where: { id: runId, userId }, select: { status: true } })
  return !run || ['cancelled', 'expired'].includes(run.status)
}

/** Stores only first-visible-content latency, never response text or tokens. */
export async function recordFirstVisibleActivityContent(userId: string, runId: string) {
  const run = await prisma.aiActivityRun.findFirst({ where: { id: runId, userId }, select: { id: true, startedAt: true } })
  if (!run) return false
  const existing = await prisma.analyticsEvent.findFirst({
    where: { userId, eventType: 'ai_first_visible_token', eventData: { contains: runId } },
    select: { id: true },
  })
  if (existing) return false
  await trackNovoLoopEvent(userId, 'ai_first_visible_token', { runId, latencyMs: Math.max(0, Date.now() - run.startedAt.getTime()) })
  return true
}

export async function finishActivityRun(userId: string, runId: string, phase: Extract<NovoActivityPhase, 'completed' | 'failed' | 'cancelled'>, fields: { resultRef?: string; resultSummary?: string; errorCode?: string; errorMessage?: string } = {}) {
  const current = await getActivityRun(userId, runId)
  if (!current) return null
  // Terminal transitions are safe to retry. In particular, a browser can
  // repeat a cancel request after a disconnect; return the owned terminal run
  // instead of making a second event or disguising it as a missing run.
  if (['completed', 'failed', 'cancelled', 'expired'].includes(current.run.status)) {
    return current.run.status === phase ? current.run : null
  }
  const event = await appendActivityEvent(userId, {
    runId, phase, label: phase === 'completed' ? 'Listo' : phase === 'cancelled' ? 'Cancelado' : 'No se pudo completar',
    detail: fields.errorMessage ?? fields.resultSummary, terminal: true, recoverable: phase === 'failed', sequence: current.run.sequence + 1,
  })
  if (!event) return null
  const durationMs = Date.now() - current.run.startedAt.getTime()
  await trackNovoLoopEvent(userId, phase === 'completed' ? 'ai_run_completed' : phase === 'failed' ? 'ai_run_failed' : 'ai_run_cancelled', { runId, durationMs, phase })
  return prisma.aiActivityRun.update({ where: { id: runId }, data: fields })
}
