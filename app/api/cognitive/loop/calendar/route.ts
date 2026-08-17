import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGoogleAccessToken } from '@/lib/google'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import { getActivityRun } from '@/lib/ai/activity'

const proposalSchema = z.object({
  actionId: z.string().cuid(), start: z.string().datetime(), end: z.string().datetime(),
  idempotencyKey: z.string().uuid(), runId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = proposalSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid calendar proposal', details: parsed.error.flatten() }, { status: 400 })
  const { actionId, start: startIso, end: endIso, idempotencyKey, runId } = parsed.data
  const start = new Date(startIso), end = new Date(endIso)
  if (end <= start || end.getTime() - start.getTime() > 4 * 60 * 60 * 1000) return NextResponse.json({ error: 'Focus block must be between 1 minute and 4 hours.' }, { status: 400 })
  const userId = session.user.id
  if (runId) {
    const run = await getActivityRun(userId, runId)
    if (!run || ['cancelled', 'expired'].includes(run.run.status)) return NextResponse.json({ error: 'This execution was cancelled.' }, { status: 409 })
  }
  const action = await prisma.recommendedAction.findFirst({ where: { id: actionId, userId }, select: { id: true, title: true, nextStep: true, status: true } })
  if (!action) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
  if (!['accepted', 'started', 'completed'].includes(action.status)) return NextResponse.json({ error: 'Accept the recommendation before scheduling it.' }, { status: 409 })
  const fingerprint = createHash('sha256').update(`${actionId}|${start.toISOString()}|${end.toISOString()}`).digest('hex')
  let execution
  try {
    execution = await prisma.externalActionExecution.create({ data: { userId, recommendedActionId: action.id, provider: 'google_calendar', operation: 'create_focus_block', idempotencyKey, requestFingerprint: fingerprint, status: 'running', startedAt: new Date() } })
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
    const existing = await prisma.externalActionExecution.findUnique({ where: { userId_provider_operation_idempotencyKey: { userId, provider: 'google_calendar', operation: 'create_focus_block', idempotencyKey } } })
    if (existing?.status === 'succeeded' && existing.externalResourceId) {
      const event = await prisma.calendarEvent.findFirst({ where: { userId, googleEventId: existing.externalResourceId } })
      return NextResponse.json({ event, duplicate: true, execution: existing })
    }
    return NextResponse.json({ error: 'Calendar action is already being processed.', execution: existing }, { status: 409 })
  }
  const account = await prisma.account.findFirst({ where: { userId, provider: 'google' }, select: { scope: true } })
  const scopes = account?.scope?.split(' ') ?? []
  const permitted = scopes.some((scope) => ['calendar', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'].includes(scope))
  if (!permitted) { await prisma.externalActionExecution.update({ where: { id: execution.id }, data: { status: 'failed', safeErrorCode: 'missing_calendar_scope', failedAt: new Date() } }); return NextResponse.json({ error: 'Google Calendar permission is required.' }, { status: 403 }) }
  if (runId) { const run = await getActivityRun(userId, runId); if (!run || ['cancelled', 'expired'].includes(run.run.status)) { await prisma.externalActionExecution.update({ where: { id: execution.id }, data: { status: 'cancelled' } }); return NextResponse.json({ error: 'This execution was cancelled.' }, { status: 409 }) } }
  const accessToken = await getGoogleAccessToken(userId, session.accessToken)
  if (!accessToken) { await prisma.externalActionExecution.update({ where: { id: execution.id }, data: { status: 'failed', safeErrorCode: 'expired_calendar_connection', failedAt: new Date() } }); return NextResponse.json({ error: 'Google Calendar connection expired.' }, { status: 403 }) }
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    auth.setCredentials({ access_token: accessToken })
    const remote = await google.calendar({ version: 'v3', auth }).events.insert({ calendarId: 'primary', requestBody: { summary: `Novo · ${action.title}`, description: `novo-loop-execution:${execution.id}\n${action.nextStep}`, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } } })
    if (!remote.data.id) throw new Error('missing_external_id')
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.calendarEvent.create({ data: { userId, title: action.title, description: `novo-loop-execution:${execution.id}\n${action.nextStep}`, start, end, source: 'ai', googleEventId: remote.data.id! } })
      await tx.externalActionExecution.update({ where: { id: execution.id }, data: { status: 'succeeded', externalResourceId: remote.data.id, completedAt: new Date() } })
      return created
    })
    await trackNovoLoopEvent(userId, 'integration_action_succeeded', { provider: 'google_calendar', actionId: action.id })
    return NextResponse.json({ event, execution }, { status: 201 })
  } catch (error) {
    await prisma.externalActionExecution.update({ where: { id: execution.id }, data: { status: 'uncertain', safeErrorCode: 'provider_dispatch_uncertain', failedAt: new Date() } })
    await trackNovoLoopEvent(userId, 'integration_action_failed', { provider: 'google_calendar', actionId: action.id })
    return NextResponse.json({ error: 'Could not confirm the Google Calendar block. Retry with the same idempotency key.' }, { status: 502 })
  }
}
