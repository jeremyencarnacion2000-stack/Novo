import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildDailySummarySignals, normalizeApplicationId, type CompanionActivityState } from '@/lib/companion/activity'
import { upsertNovoSignals } from '@/lib/cognitive/signal-ledger'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { CompanionError, requireCompanionOAuth } from '@/lib/companion/auth'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { companionErrorResponse } from '@/lib/companion/http'

export const dynamic = 'force-dynamic'

const SERVER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_SIGNAL_SUMMARY_ROWS = 5_000

function isActivityState(value: string): value is CompanionActivityState {
  return value === 'active' || value === 'idle' || value === 'locked'
}

const activityDailySummarySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Invalid UTC day'),
  applicationId: z.string().max(128)
    .transform((value) => normalizeApplicationId(value))
    .refine((value): value is string => value !== null, 'Invalid application identifier'),
  state: z.enum(['active', 'idle', 'locked']),
  durationSeconds: z.number().int().min(1).max(86_400),
}).strict()

const activityBatchSchema = z.object({
  deviceId: z.string().uuid(),
  summaries: z.array(activityDailySummarySchema).min(1).max(200),
}).strict()

async function resolveReadUser(request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return session.user.id

  const validated = await validateMcpBearerToken(request)
  if (!validated.ok || !validated.authInfo.scopes.includes('device:activity:read')) return null
  if (validated.authInfo.scopes.includes('device:connect')) {
    const actor = await requireCompanionOAuth(request, ['device:connect', 'device:activity:read'])
    await requireActiveCompanionDevice(actor, request.headers.get('X-Novo-Device-Id'))
  }
  return validated.userId
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveReadUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const preference = await prisma.novoSignalSourcePreference.findUnique({
      where: { userId_source: { userId, source: 'device' } },
      select: { excludedAt: true },
    })
    if (preference?.excludedAt) {
      return NextResponse.json({ sourceExcluded: true, signals: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const since = new Date(Date.now() - SERVER_RETENTION_MS)
    const signals = await prisma.novoSignalLedger.findMany({
      where: { userId, source: 'device', observedAt: { gte: since }, excludedAt: null },
      select: { sourceRef: true, signalType: true, label: true, observedAt: true, reliability: true, correction: true },
      orderBy: { observedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      sourceExcluded: false,
      signals: signals.map(({ sourceRef, signalType, label, observedAt, reliability, correction }) => ({
        sourceRef,
        signalType,
        label: correction?.trim() || label,
        observedAt,
        reliability,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CompanionError) return companionErrorResponse(error)
    console.error('[companion/activity GET] Request failed.')
    return NextResponse.json({ error: 'Companion activity is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const validated = await validateMcpBearerToken(request)
    if (!validated.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const scopes = Array.isArray(validated.authInfo.scopes) ? validated.authInfo.scopes : []
    if (!scopes.includes('device:activity:write')) {
      return NextResponse.json({ error: 'Insufficient device activity permission.' }, { status: 403 })
    }

    const parsed = activityBatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid activity summary.' }, { status: 400 })

    if (scopes.includes('device:connect')) {
      const actor = await requireCompanionOAuth(request, ['device:connect', 'device:activity:write'])
      const deviceId = request.headers.get('X-Novo-Device-Id')
      if (deviceId !== parsed.data.deviceId) throw new CompanionError(400, 'device_id_mismatch')
      await requireActiveCompanionDevice(actor, deviceId)
    }

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const oldestAllowed = today.getTime() - 7 * 24 * 60 * 60 * 1000
    const hasInvalidDay = parsed.data.summaries.some((summary) => {
      const day = Date.parse(`${summary.day}T00:00:00.000Z`)
      return day < oldestAllowed || day > today.getTime()
    })
    if (hasInvalidDay) return NextResponse.json({ error: 'Activity summary is outside the allowed sync window.' }, { status: 400 })

    const sourcePreference = await prisma.novoSignalSourcePreference.findUnique({
      where: { userId_source: { userId: validated.userId, source: 'device' } },
      select: { excludedAt: true },
    })
    if (sourcePreference?.excludedAt) {
      return NextResponse.json({ accepted: 0, skipped: parsed.data.summaries.length, reason: 'source_excluded' })
    }

    const summariesByKey = new Map<string, (typeof parsed.data.summaries)[number]>()
    for (const summary of parsed.data.summaries) {
      const key = `${summary.day}:${summary.applicationId}:${summary.state}`
      const previous = summariesByKey.get(key)
      if (!previous || summary.durationSeconds > previous.durationSeconds) summariesByKey.set(key, summary)
    }
    const snapshots = [...summariesByKey.values()]
    const dayExpiresAt = (day: string) => new Date(Date.parse(`${day}T00:00:00.000Z`) + SERVER_RETENTION_MS)

    // One parameterized statement avoids opening up to 200 concurrent Prisma
    // calls. GREATEST makes delayed retries monotonic, so an older snapshot
    // cannot overwrite a newer, larger daily duration.
    const rows = snapshots.map((summary) => {
      const day = new Date(`${summary.day}T00:00:00.000Z`)
      const expiresAt = dayExpiresAt(summary.day)
      return Prisma.sql`(${randomUUID()}, ${validated.userId}, ${parsed.data.deviceId}, ${day}, ${summary.applicationId}, ${summary.state}, ${summary.durationSeconds}, ${expiresAt})`
    })
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "companion_activity_daily_summaries"
        ("id", "userId", "deviceId", "day", "applicationId", "state", "durationSeconds", "expiresAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("userId", "deviceId", "day", "applicationId", "state")
      DO UPDATE SET
        "durationSeconds" = GREATEST("companion_activity_daily_summaries"."durationSeconds", EXCLUDED."durationSeconds"),
        "expiresAt" = EXCLUDED."expiresAt"
    `)

    const touchedDays = [...new Set(snapshots.map((summary) => summary.day))].map((day) => new Date(`${day}T00:00:00.000Z`))
    const storedSummaries = await prisma.companionActivityDailySummary.findMany({
      where: { userId: validated.userId, day: { in: touchedDays }, expiresAt: { gt: now } },
      select: { deviceId: true, day: true, applicationId: true, state: true, durationSeconds: true },
      orderBy: [{ day: 'asc' }, { deviceId: 'asc' }, { applicationId: 'asc' }],
      take: MAX_SIGNAL_SUMMARY_ROWS,
    })
    const safeSummaries = storedSummaries.flatMap((summary) => isActivityState(summary.state) ? [{
      deviceId: summary.deviceId,
      day: summary.day,
      applicationId: summary.applicationId,
      state: summary.state,
      durationSeconds: summary.durationSeconds,
    }] : [])
    await upsertNovoSignals(validated.userId, buildDailySummarySignals(safeSummaries, now))

    return NextResponse.json({ accepted: snapshots.length, skipped: parsed.data.summaries.length - snapshots.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CompanionError) return companionErrorResponse(error)
    console.error('[companion/activity POST] Request failed.')
    return NextResponse.json({ error: 'Companion activity is temporarily unavailable.' }, { status: 503 })
  }
}
