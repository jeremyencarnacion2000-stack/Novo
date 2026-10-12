import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clientSchema } from '@/lib/schemas/client'
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

    const clients = await prisma.client.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients.')
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
    const parsedBody = clientSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, email, phone, status } = parsedBody.data

    const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    const result = await runIdempotentCreate(prisma, {
      userId: session.user.id,
      scope: 'client_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(parsedBody.data),
      resourceType: 'client',
      create: (db) => db.client.create({
        data: { name, email, phone, status, userId: session.user.id },
      }),
      findResource: (resourceId, db) => db.client.findFirst({
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
    console.error('Error creating client.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
