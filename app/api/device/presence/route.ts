import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

// A brief allowance for client/server clock drift — endedAt should never be
// meaningfully in the future, but a few minutes of skew is normal.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000
const deviceSurfaceSchema = z.enum(['web_desktop', 'web_mobile', 'pwa_desktop', 'pwa_mobile'])

const devicePresenceSchema = z
  .object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    surface: deviceSurfaceSchema.optional().default('web_desktop'),
    // sendBeacon cannot attach request headers, so the client carries the
    // same intent key in the body when a session is closed during unload.
    sessionId: z.string().uuid().optional(),
  })
  .refine(
    (data) => new Date(data.endedAt).getTime() > new Date(data.startedAt).getTime(),
    { message: 'endedAt must be after startedAt' }
  )
  .refine(
    (data) => new Date(data.endedAt).getTime() <= Date.now() + CLOCK_SKEW_TOLERANCE_MS,
    { message: 'endedAt cannot be in the future' }
  )

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json().catch(() => null)
    const parsed = devicePresenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'InvalidBody' }, { status: 400 })
    }

    const headerKey = readIdempotencyKey(request)
    if (headerKey.invalid) return NextResponse.json({ error: 'InvalidIdempotencyKey' }, { status: 400 })
    const idempotencyKey = headerKey.key ?? parsed.data.sessionId ?? null
    const eventData = {
      userId,
      startedAt: new Date(parsed.data.startedAt),
      endedAt: new Date(parsed.data.endedAt),
      surface: parsed.data.surface,
    }
    const result = await runIdempotentCreate(prisma, {
      userId,
      scope: 'device_presence_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(eventData),
      resourceType: 'device_activity_event',
      create: (db) => db.deviceActivityEvent.create({ data: eventData }),
      findResource: (resourceId, db) => db.deviceActivityEvent.findFirst({ where: { id: resourceId, userId } }),
    })

    return NextResponse.json({ success: true, replayed: result.replay }, {
      headers: { 'X-Idempotent-Replay': String(result.replay) },
    })
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: 'IdempotencyConflict' }, { status: 409 })
    }
    console.error('Device presence API error.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
