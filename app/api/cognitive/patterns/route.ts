/**
 * /api/cognitive/patterns
 * ─────────────────────────────────────────────────────────────────────────────
 * Persists and retrieves cognitive learning data for the memory engine.
 *
 * GET  → returns the user's full CognitiveLearningProfile (built server-side)
 * POST → records a daily fatigue sample or a task-completion timestamp
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildLearningProfile } from '@/lib/cognitive-memory'

// ─── GET: Build and return the full learning profile ─────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Fetch focus sessions (last 90 days)
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const [focusSessions] = await Promise.all([
      prisma.focusSession.findMany({
        where: { userId, startTime: { gte: since } },
        select: {
          startTime: true,
          focusQuality: true,
          completed: true,
          endTime: true,
        },
        orderBy: { startTime: 'asc' },
      }),
    ])

    // Build task completion timestamps from completed focus sessions
    const taskCompletions = focusSessions
      .filter(fs => fs.completed && fs.endTime)
      .map(fs => ({ completedAt: fs.endTime!.toISOString() }))

    const profile = buildLearningProfile(userId, {
      focusSessions: focusSessions.map(fs => ({
        startTime: fs.startTime.toISOString(),
        focusQuality: fs.focusQuality ?? undefined,
        completed: fs.completed,
      })),
      taskCompletions,
      // Productivity and completion counts are not physiological fatigue
      // samples. No fatigue trend is inferred until a source-led user report
      // exists in the verified loop.
      fatigueHistory: [],
    })

    return NextResponse.json(profile)
  } catch {
    console.error('[cognitive/patterns] GET failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: Record a fatigue sample or completion event ────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await request.json()
    const { type, data } = body

    if (type === 'fatigue_sample') {
      // This legacy input had no reliable source ledger and converted a
      // client-provided number into both fatigue and productivity. Preserve
      // neither claim; the verified state check-in is the supported input.
      return NextResponse.json({
        error: 'DeprecatedSignal',
        message: 'Las muestras heredadas no se aceptan. Usa el check-in de estado.',
      }, { status: 410 })
    }

    if (type === 'focus_quality') {
      // Record a focus session quality update (post-session rating)
      const { sessionId, quality } = data
      if (!sessionId || typeof quality !== 'number') {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      }

      await prisma.focusSession.updateMany({
        where: { id: sessionId, userId },
        data: { focusQuality: Math.max(1, Math.min(5, quality)) },
      })

      return NextResponse.json({ ok: true, type: 'focus_quality' })
    }

    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
  } catch {
    console.error('[cognitive/patterns] POST failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
