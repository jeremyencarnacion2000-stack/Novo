import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitTwinSignal } from '@/lib/twin-signal'

const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const FOCUS_SESSION_FINISH_SCOPE = 'focus_session_finish'

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function sessionResponse(session: unknown, replay: boolean) {
  const response = NextResponse.json({ ok: true, session, replay }, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
}

/**
 * POST /api/focus-sessions
 * Called by the focus timer widget when a session starts or ends.
 *
 * Body:
 *   { event: 'started' | 'finished', duration?: number, quality?: number, taskTitle?: string }
 *
 * Returns: { ok: true }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, duration, quality, taskTitle, sessionType, taskId, interrupted } = body

    if (!event || !['started', 'finished'].includes(event)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    const signal = event === 'started' ? 'focus_started' : 'focus_finished'

    // Persist to FocusSession table if finishing a real work session
    if (event === 'finished' && duration) {
      const rawIdempotencyKey = request.headers.get('Idempotency-Key')
      const idempotencyKey = rawIdempotencyKey?.trim() || null
      if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
        return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
      }
      const fingerprint = JSON.stringify({
        event,
        duration,
        quality: quality ?? null,
        taskTitle: typeof taskTitle === 'string' ? taskTitle.slice(0, 240) : null,
        sessionType: sessionType === 'break' ? 'break' : 'work',
        taskId: typeof taskId === 'string' ? taskId.slice(0, 200) : null,
        interrupted: Boolean(interrupted),
      })

      if (idempotencyKey) {
        const existing = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: FOCUS_SESSION_FINISH_SCOPE, idempotencyKey } },
        })
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
          }
          const existingSession = await prisma.focusSession.findFirst({ where: { id: existing.resourceId, userId: session.user.id } })
          if (existingSession) return sessionResponse(existingSession, true)
          return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
        }
      }

      const createFocusSession = (db: typeof prisma) => db.focusSession.create({
        data: {
          userId: session.user.id,
          startTime: new Date(Date.now() - duration * 60 * 1000),
          endTime: new Date(),
          duration,
          actualDuration: duration,
          sessionType: sessionType === 'break' ? 'break' : 'work',
          completed: true,
          interrupted: Boolean(interrupted),
          focusQuality: quality ?? null,
          taskTitle: typeof taskTitle === 'string' ? taskTitle.slice(0, 240) : null,
          taskId: typeof taskId === 'string' ? taskId.slice(0, 200) : null,
        },
      })

      let persistedSession: unknown = null
      let replay = false
      try {
        if (!idempotencyKey) {
          persistedSession = await createFocusSession(prisma)
        } else {
          persistedSession = await prisma.$transaction(async (tx) => {
            await tx.mutationRequest.create({
              data: {
                userId: session.user.id,
                scope: FOCUS_SESSION_FINISH_SCOPE,
                idempotencyKey,
                fingerprint,
                resourceType: 'focus_session',
                resourceId: 'pending',
              },
            })
            const created = await createFocusSession(tx as typeof prisma)
            await tx.mutationRequest.update({
              where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: FOCUS_SESSION_FINISH_SCOPE, idempotencyKey } },
              data: { resourceId: created.id },
            })
            return created
          })
        }
      } catch {
        // A telemetry write must not make the timer look broken. For a
        // concurrent retry, however, converge on the transaction winner.
        if (idempotencyKey) {
          try {
            const winner = await prisma.mutationRequest.findUnique({
              where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: FOCUS_SESSION_FINISH_SCOPE, idempotencyKey } },
            })
            if (winner?.fingerprint === fingerprint && winner.resourceId !== 'pending') {
              const winnerSession = await prisma.focusSession.findFirst({ where: { id: winner.resourceId, userId: session.user.id } })
              if (winnerSession) {
                persistedSession = winnerSession
                replay = true
              }
            }
          } catch {
            // Keep the legacy best-effort behavior for a database outage.
          }
        }
      }

      if (persistedSession) {
        if (!replay) emitTwinSignal({ userId: session.user.id, signal, duration, quality })
        return sessionResponse(persistedSession, replay)
      }
    }

    // Emit behavioral signal (fire-and-forget)
    emitTwinSignal({
      userId: session.user.id,
      signal,
      duration,
      quality,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Keep request payloads and provider/database details out of logs. The
    // client only needs a stable error response; operators can correlate the
    // route failure with platform request logs by status and timestamp.
    console.error('Error logging focus session:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
