/**
 * /api/cognitive/daily-summary
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns a concise summary of today's cognitive and productivity metrics.
 * Used by the VoiceExecutor's `summarize_day` command and the dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  try {
    const [
      tasksCompleted,
      tasksPending,
      focusSessions,
      snapshot,
      insights,
    ] = await Promise.all([
      // Tasks completed today
      prisma.task.count({
        where: { userId, status: 'done', updatedAt: { gte: today, lt: tomorrow } },
      }),
      // Tasks still pending
      prisma.task.count({
        where: { userId, status: { in: ['todo', 'in-progress'] } },
      }),
      // Focus sessions today
      prisma.focusSession.findMany({
        where: { userId, startTime: { gte: today, lt: tomorrow } },
        select: { actualDuration: true, duration: true, completed: true, focusQuality: true },
      }),
      // Current cognitive snapshot
      prisma.userCognitiveSnapshot.findUnique({ where: { userId } }),
      // Unread insights
      prisma.insight.findMany({
        where: { userId, status: 'unread' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { content: true, type: true },
      }),
    ])

    const focusMinutes = focusSessions.reduce((sum, s) => {
      const mins = (s.actualDuration ?? s.duration) / 60
      return sum + mins
    }, 0)

    const completedSessions = focusSessions.filter(s => s.completed).length
    const avgQuality = focusSessions.length > 0
      ? focusSessions.reduce((sum, s) => sum + (s.focusQuality ?? 3), 0) / focusSessions.length
      : 0

    return NextResponse.json({
      date: today.toISOString().split('T')[0],
      tasksCompleted,
      tasksPending,
      focusMinutes: Math.round(focusMinutes),
      focusSessionsCompleted: completedSessions,
      avgFocusQuality: Math.round(avgQuality * 10) / 10,
      fatigueEstimate: snapshot?.fatigueEstimate ?? 'unavailable',
      productivityScore: snapshot?.productivityScore ?? 0,
      insights: insights.map(i => ({ message: i.content, type: i.type })),
    })
  } catch {
    console.error('[cognitive/daily-summary] GET failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
