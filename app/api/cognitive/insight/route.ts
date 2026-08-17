/**
 * /api/cognitive/insight
 * POST → Creates a new cognitive insight for the authenticated user.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await request.json()
    const { type, content } = body

    if (!type || !content) {
      return NextResponse.json({ error: 'Missing type or content' }, { status: 400 })
    }

    // Fatigue/burnout claims must originate in an explicitly sourced,
    // user-visible check-in flow. This legacy endpoint is not such a source.
    const validTypes = ['productivity', 'habit', 'peak_focus', 'general']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid insight type' }, { status: 400 })
    }

    const insight = await prisma.insight.create({
      data: {
        userId,
        type,
        content: String(content).slice(0, 1000), // max 1000 chars
        status: 'unread',
      },
    })

    // Also update cognitive snapshot's lastInsightGeneratedAt
    await prisma.userCognitiveSnapshot.upsert({
      where: { userId },
      create: {
        userId,
        lastInsightGeneratedAt: new Date(),
        fatigueEstimate: 'unavailable',
        focusTimeToday: 0,
        productivityScore: 0,
        overdueTasks: 0,
      },
      update: {
        lastInsightGeneratedAt: new Date(),
      },
    })

    return NextResponse.json(insight, { status: 201 })
  } catch {
    console.error('[cognitive/insight] POST failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const insights = await prisma.insight.findMany({
    where: { userId: session.user.id, status: 'unread' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json(insights)
}
