import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const checklistItemSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  completed: z.boolean().optional().default(false),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().optional().nullable(),
  source: z.string().optional().default('manual'),
  sourceId: z.string().optional().nullable()
})

const CHECKLIST_CREATE_SCOPE = 'checklist_create'

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function replayResponse(item: unknown) {
  const response = NextResponse.json(item)
  response.headers.set('X-Idempotent-Replay', 'true')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.checklistItem.findMany({
      where: { userId: session.user.id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: { select: { id: true, title: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching checklist items.')
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
    const parsedBody = checklistItemSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { text, completed, priority, dueDate, source, sourceId } = parsedBody.data
    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (rawIdempotencyKey !== null && (!idempotencyKey || idempotencyKey.length > 128)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify({ text, completed, priority, dueDate: dueDate ?? null, source, sourceId: sourceId ?? null })

    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: CHECKLIST_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        const previous = await prisma.checklistItem.findFirst({ where: { id: existing.resourceId, userId: session.user.id } })
        if (previous) return replayResponse(previous)
      }
    }

    let item
    try {
      item = await prisma.$transaction(async (tx) => {
        const created = await tx.checklistItem.create({
          data: {
            text,
            completed,
            priority,
            source,
            sourceId: sourceId || undefined,
            dueDate: dueDate ? new Date(dueDate) : null,
            userId: session.user.id
          }
        })
        if (idempotencyKey) {
          await tx.mutationRequest.create({
            data: { userId: session.user.id, scope: CHECKLIST_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'checklist_item', resourceId: created.id },
          })
        }
        return created
      })
    } catch (error) {
      if (idempotencyKey && isUniqueConstraint(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: CHECKLIST_CREATE_SCOPE, idempotencyKey } },
        })
        if (winner && winner.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        if (winner) {
          const previous = await prisma.checklistItem.findFirst({ where: { id: winner.resourceId, userId: session.user.id } })
          if (previous) return replayResponse(previous)
        }
      }
      throw error
    }

    const response = NextResponse.json(item, { status: 201 })
    response.headers.set('X-Idempotent-Replay', 'false')
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating checklist item.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
