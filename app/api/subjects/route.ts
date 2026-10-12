import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSubjectSchema } from '@/lib/schemas/subject'
import { z } from 'zod'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subjects = await prisma.subject.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(subjects)
  } catch (error) {
    console.error('Error fetching subjects.')
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
    const parsedBody = createSubjectSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, description } = parsedBody.data

    const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    const result = await runIdempotentCreate(prisma, {
      userId: session.user.id,
      scope: 'subject_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(parsedBody.data),
      resourceType: 'subject',
      create: (db) => db.subject.create({
        data: { name, description, userId: session.user.id },
      }),
      findResource: (resourceId, db) => db.subject.findFirst({
        where: { id: resourceId, userId: session.user.id },
      }),
    })

    const response = NextResponse.json(result.resource, { status: result.replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(result.replay))
    return response
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating subject.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
