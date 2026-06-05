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
import {
  buildLearningProfile,
  predictBurnout,
  learnPeakHours,
  extractPeakHours,
  inferChronotype,
  type DailyFatigueSample,
} from '@/lib/cognitive-memory'

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

    const [focusSessions, snapshot, dailyAnalytics] = await Promise.all([
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
      prisma.userCognitiveSnapshot.findUnique({ where: { userId } }),
      prisma.dailyAnalytics.findMany({
        where: { userId, date: { gte: since } },
        orderBy: { date: 'asc' },
      }),
    ])

    // Build fatigue history from daily analytics
    const fatigueHistory: DailyFatigueSample[] = dailyAnalytics.map(d => ({
      date: d.date.toISOString().split('T')[0],
      fatigueScore: Math.min(100, Math.max(0, 100 - d.productivityScore * 10)),
      tasksCompleted: d.completions,
      focusMinutes: Math.round(d.totalTime / 60),
      phase: 'unknown',
    }))

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
      fatigueHistory,
    })

    // Attach current snapshot data if available
    if (snapshot) {
      profile.burnoutPrediction = {
        ...profile.burnoutPrediction,
        risk: snapshot.fatigueEstimate === 'high' ? 'high'
          : snapshot.fatigueEstimate === 'medium' ? 'moderate' : 'low',
      }
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('[cognitive/patterns] GET error:', error)
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
      const sample = data as DailyFatigueSample

      // Upsert the daily analytics row with fatigue inference
      const date = new Date(sample.date)
      const productivityScore = Math.max(0, (100 - sample.fatigueScore) / 10)

      await prisma.dailyAnalytics.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          totalTime: sample.focusMinutes * 60,
          completions: sample.tasksCompleted,
          productivityScore,
          modulesUsed: '[]',
        },
        update: {
          totalTime: sample.focusMinutes * 60,
          completions: sample.tasksCompleted,
          productivityScore,
        },
      })

      // Also refresh the snapshot fatigue estimate
      const fatigue = sample.fatigueScore >= 70 ? 'high'
        : sample.fatigueScore >= 40 ? 'medium' : 'low'

      await prisma.userCognitiveSnapshot.upsert({
        where: { userId },
        create: {
          userId,
          fatigueEstimate: fatigue,
          focusTimeToday: sample.focusMinutes,
          productivityScore,
          overdueTasks: 0,
        },
        update: {
          fatigueEstimate: fatigue,
          focusTimeToday: sample.focusMinutes,
          productivityScore,
        },
      })

      return NextResponse.json({ ok: true, type: 'fatigue_sample' })
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
  } catch (error) {
    console.error('[cognitive/patterns] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
