import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const activityHistorySchema = z.object({
  activity: z.string().min(1, 'Activity is required'),
  date: z.string().datetime('Invalid date'),
  duration: z.number().optional().nullable()
})

const ACTIVITY_HISTORY_SCOPE = 'activity_history_create'

function validIdempotencyKey(request: NextRequest) {
  const value = request.headers.get('Idempotency-Key')?.trim()
  return value && value.length <= 128 ? value : null
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where = { userId: session.user.id }

    const [activityHistory, total] = await Promise.all([
      prisma.activityHistory.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityHistory.count({ where }),
    ])

    const response = NextResponse.json(activityHistory)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
  } catch {
    console.error('Error fetching activity history')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = activityHistorySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { activity, date, duration } = parsedBody.data
    const idempotencyKey = validIdempotencyKey(request)
    if (request.headers.has('Idempotency-Key') && !idempotencyKey) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify({ activity, date, duration: duration ?? null })

    if (idempotencyKey) {
      const existingMutation = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: ACTIVITY_HISTORY_SCOPE, idempotencyKey } },
      })
      if (existingMutation) {
        if (existingMutation.fingerprint !== fingerprint) {
          return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        }
        const existingEntry = await prisma.activityHistory.findFirst({ where: { id: existingMutation.resourceId, userId: session.user.id } })
        if (existingEntry) {
          const response = NextResponse.json(existingEntry)
          response.headers.set('X-Idempotent-Replay', 'true')
          return response
        }
      }
    }

    try {
      const activityEntry = await prisma.$transaction(async (tx) => {
        const created = await tx.activityHistory.create({
          data: { activity, date, duration, userId: session.user.id },
        })
        if (idempotencyKey) {
          await tx.mutationRequest.create({
            data: {
              userId: session.user.id,
              scope: ACTIVITY_HISTORY_SCOPE,
              idempotencyKey,
              fingerprint,
              resourceType: 'activity_history',
              resourceId: created.id,
            },
          })
        }
        return created
      })
      const response = NextResponse.json(activityEntry, { status: 201 })
      response.headers.set('X-Idempotent-Replay', 'false')
      return response
    } catch (error) {
      if (idempotencyKey && isUniqueConstraint(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: ACTIVITY_HISTORY_SCOPE, idempotencyKey } },
        })
        if (winner) {
          if (winner.fingerprint !== fingerprint) {
            return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
          }
          const existingEntry = await prisma.activityHistory.findFirst({ where: { id: winner.resourceId, userId: session.user.id } })
          if (existingEntry) {
            const response = NextResponse.json(existingEntry)
            response.headers.set('X-Idempotent-Replay', 'true')
            return response
          }
        }
      }
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating activity history')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
