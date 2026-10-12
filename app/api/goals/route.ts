import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
  timeframe: z.string().max(50).optional(),
  deadline: z.string().max(100).optional(),
})

const GOAL_CREATE_SCOPE = 'goal_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function goalResponse(goal: { id: string }, replay: boolean) {
  const response = NextResponse.json(goal, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
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

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goal.count({ where }),
    ])

    const response = NextResponse.json(goals)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
  } catch {
    console.error('Error fetching goals.')
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
    const parsed = createGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { title, description, status, timeframe, deadline } = parsed.data
    const normalized = {
      title,
      description: description ?? null,
      status: status || 'active',
      timeframe: timeframe || 'year',
      deadline: deadline ?? null,
    }
    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify(normalized)

    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: {
          userId_scope_idempotencyKey: {
            userId: session.user.id,
            scope: GOAL_CREATE_SCOPE,
            idempotencyKey,
          },
        },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        }
        const previousGoal = await prisma.goal.findFirst({
          where: { id: existing.resourceId, userId: session.user.id },
        })
        if (previousGoal) return goalResponse(previousGoal, true)
        return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
      }
    }

    const createGoal = (db: typeof prisma) => db.goal.create({
      data: { userId: session.user.id, ...normalized },
    })

    let goal
    if (!idempotencyKey) {
      goal = await createGoal(prisma)
    } else {
      try {
        goal = await prisma.$transaction(async (tx) => {
          await tx.mutationRequest.create({
            data: {
              userId: session.user.id,
              scope: GOAL_CREATE_SCOPE,
              idempotencyKey,
              fingerprint,
              resourceType: 'goal',
              resourceId: 'pending',
            },
          })
          const created = await createGoal(tx as typeof prisma)
          await tx.mutationRequest.update({
            where: {
              userId_scope_idempotencyKey: {
                userId: session.user.id,
                scope: GOAL_CREATE_SCOPE,
                idempotencyKey,
              },
            },
            data: { resourceId: created.id },
          })
          return created
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const winner = await prisma.mutationRequest.findUnique({
            where: {
              userId_scope_idempotencyKey: {
                userId: session.user.id,
                scope: GOAL_CREATE_SCOPE,
                idempotencyKey,
              },
            },
          })
          if (winner?.fingerprint === fingerprint && winner.resourceId !== 'pending') {
            const existingGoal = await prisma.goal.findFirst({
              where: { id: winner.resourceId, userId: session.user.id },
            })
            if (existingGoal) return goalResponse(existingGoal, true)
          }
        }
        throw error
      }
    }

    return goalResponse(goal, false)
  } catch {
    console.error('Error creating goal.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const goal = await prisma.goal.update({
      where: {
        id,
        userId: session.user.id
      },
      data: updates
    })

    return NextResponse.json(goal)
  } catch {
    console.error('Error updating goal.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.goal.delete({
      where: {
        id,
        userId: session.user.id
      }
    })

    return NextResponse.json({ success: true })
  } catch {
    console.error('Error deleting goal.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
