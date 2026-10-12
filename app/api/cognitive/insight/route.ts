/**
 * /api/cognitive/insight
 * POST → Creates a new cognitive insight for the authenticated user.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

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

    const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    const insightData = {
      userId,
      type,
      content: String(content).slice(0, 1000), // max 1000 chars
      status: 'unread',
    }
    const result = await runIdempotentCreate(prisma, {
      userId,
      scope: 'cognitive_insight_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint({ type, content: insightData.content }),
      resourceType: 'insight',
      create: async (db) => {
        const insight = await db.insight.create({ data: insightData })

        // Keep the snapshot update in the same transaction as the insight so
        // a transport retry cannot leave a partial cognitive write behind.
        await db.userCognitiveSnapshot.upsert({
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
        return insight
      },
      findResource: (resourceId, db) => db.insight.findFirst({ where: { id: resourceId, userId } }),
    })

    return NextResponse.json(result.resource, {
      status: result.replay ? 200 : 201,
      headers: { 'X-Idempotent-Replay': String(result.replay) },
    })
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
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
