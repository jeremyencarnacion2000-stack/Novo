import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitTwinSignal } from '@/lib/twin-signal'

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
    const { event, duration, quality, taskTitle } = body

    if (!event || !['started', 'finished'].includes(event)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    const signal = event === 'started' ? 'focus_started' : 'focus_finished'

    // Persist to FocusSession table if finishing a real work session
    if (event === 'finished' && duration) {
      try {
        await prisma.focusSession.create({
          data: {
            userId: session.user.id,
            startTime: new Date(Date.now() - duration * 60 * 1000),
            endTime: new Date(),
            duration,
            actualDuration: duration,
            sessionType: 'work',
            completed: true,
            focusQuality: quality ?? null,
            taskTitle: taskTitle ?? null,
          },
        })
      } catch {
        // Non-critical — signal still fires even if DB write fails
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
    console.error('Error logging focus session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
