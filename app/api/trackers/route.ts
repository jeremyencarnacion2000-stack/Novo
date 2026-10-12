import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { trackerSchema } from '@/lib/schemas/tracker'
import { z } from 'zod'

const TRACKER_CREATE_SCOPE = 'tracker_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function trackerResponse(tracker: unknown, replay: boolean) {
  const response = NextResponse.json(tracker, { status: replay ? 200 : 201 })
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

    const [trackers, total] = await Promise.all([
      prisma.tracker.findMany({
        where,
        include: { entries: { take: 30, orderBy: { date: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tracker.count({ where }),
    ])

    const response = NextResponse.json(trackers)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
  } catch (error) {
    console.error('Error fetching trackers.')
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
    const parsedBody = trackerSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, type, unit, goal, entries = [] } = parsedBody.data

    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify({ name, type, unit, goal, entries })
    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TRACKER_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        const existingTracker = await prisma.tracker.findFirst({
          where: { id: existing.resourceId, userId: session.user.id },
          include: { entries: true },
        })
        if (existingTracker) return trackerResponse(existingTracker, true)
        return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
      }
    }

    const createTracker = (db: typeof prisma) => db.tracker.create({
      data: {
        name,
        type,
        unit,
        goal,
        userId: session.user.id,
        entries: {
          create: entries.map((entry: any) => ({
            date: entry.date,
            value: entry.value
          }))
        }
      },
      include: { entries: true }
    })

    if (!idempotencyKey) return trackerResponse(await createTracker(prisma), false)

    try {
      const tracker = await prisma.$transaction(async (tx) => {
        await tx.mutationRequest.create({
          data: { userId: session.user.id, scope: TRACKER_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'tracker', resourceId: 'pending' },
        })
        const created = await createTracker(tx as typeof prisma)
        await tx.mutationRequest.update({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TRACKER_CREATE_SCOPE, idempotencyKey } },
          data: { resourceId: created.id },
        })
        return created
      })
      return trackerResponse(tracker, false)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TRACKER_CREATE_SCOPE, idempotencyKey } },
        })
        if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
          const winnerTracker = await prisma.tracker.findFirst({
            where: { id: winner.resourceId, userId: session.user.id },
            include: { entries: true },
          })
          if (winnerTracker) return trackerResponse(winnerTracker, true)
        }
      }
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating tracker.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
