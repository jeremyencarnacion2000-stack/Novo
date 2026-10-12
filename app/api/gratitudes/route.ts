import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gratitudeSchema } from '@/lib/schemas/gratitude'
import { z } from 'zod'

const GRATITUDE_CREATE_SCOPE = 'gratitude_create'

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function replayResponse(gratitude: unknown) {
  const response = NextResponse.json(gratitude)
  response.headers.set('X-Idempotent-Replay', 'true')
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

    const [gratitudes, total] = await Promise.all([
      prisma.gratitude.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gratitude.count({ where }),
    ])

    const response = NextResponse.json(gratitudes)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
  } catch (error) {
    console.error('Error fetching gratitudes.')
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
    const parsedBody = gratitudeSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { content, date } = parsedBody.data
    const normalizedDate = date || new Date().toISOString()
    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (rawIdempotencyKey !== null && (!idempotencyKey || idempotencyKey.length > 128)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify({ content, date: normalizedDate })

    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: GRATITUDE_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        const previous = await prisma.gratitude.findFirst({ where: { id: existing.resourceId, userId: session.user.id } })
        if (previous) return replayResponse(previous)
      }
    }

    let gratitude
    try {
      gratitude = await prisma.$transaction(async (tx) => {
        const created = await tx.gratitude.create({
          data: { content, date: normalizedDate, userId: session.user.id }
        })
        if (idempotencyKey) {
          await tx.mutationRequest.create({
            data: { userId: session.user.id, scope: GRATITUDE_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'gratitude', resourceId: created.id },
          })
        }
        return created
      })
    } catch (error) {
      if (idempotencyKey && isUniqueConstraint(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: GRATITUDE_CREATE_SCOPE, idempotencyKey } },
        })
        if (winner && winner.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        if (winner) {
          const previous = await prisma.gratitude.findFirst({ where: { id: winner.resourceId, userId: session.user.id } })
          if (previous) return replayResponse(previous)
        }
      }
      throw error
    }

    const response = NextResponse.json(gratitude, { status: 201 })
    response.headers.set('X-Idempotent-Replay', 'false')
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating gratitude.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
