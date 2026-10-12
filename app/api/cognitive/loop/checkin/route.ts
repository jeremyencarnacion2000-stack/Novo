import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stateCheckinSchema } from '@/lib/schemas/cognitive-loop'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

const MAX_CHECKIN_BODY_BYTES = 32_000

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_CHECKIN_BODY_BYTES) {
    return NextResponse.json({ error: 'Check-in payload is too large' }, { status: 413 })
  }

  const parsed = stateCheckinSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid check-in', details: parsed.error.flatten() }, { status: 400 })

  const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
  if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

  const data = parsed.data
  const completeness = [data.energy, data.focus, data.availableMinutes, data.workload, data.currentContext].filter(Boolean).length / 5

  try {
    const result = await runIdempotentCreate(prisma, {
      userId: session.user.id,
      scope: 'cognitive_checkin_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(data),
      resourceType: 'cognitive_state_snapshot',
      create: (db) => db.cognitiveStateSnapshot.create({
        data: {
          userId: session.user.id,
          energy: data.energy,
          focus: data.focus,
          availableMinutes: data.availableMinutes,
          workload: data.workload,
          currentContext: data.currentContext,
          completeness,
        },
      }),
      findResource: (resourceId, db) => db.cognitiveStateSnapshot.findFirst({
        where: { id: resourceId, userId: session.user.id },
      }),
    })

    if (!result.replay) {
      await trackNovoLoopEvent(session.user.id, 'state_checkin_completed', { completeness, source: 'checkin' })
    }

    const response = NextResponse.json({ snapshot: result.resource }, { status: 200 })
    response.headers.set('X-Idempotent-Replay', String(result.replay))
    return response
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[cognitive/loop/checkin] POST failed.')
    return NextResponse.json({ error: 'Unable to save this check-in right now' }, { status: 500 })
  }
}
