import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

const businessClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['active', 'proposal', 'inactive']).optional().default('proposal'),
  projects: z.number().int().min(0).optional().default(0)
})

const businessContentIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  platform: z.string().optional().default('Blog'),
  status: z.enum(['draft', 'scheduled', 'published']).optional().default('draft')
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'clients') {
      const clients = await prisma.businessClient.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' }
      })
      return NextResponse.json(clients)
    } else if (type === 'content') {
      const content = await prisma.businessContentIdea.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' }
      })
      return NextResponse.json(content)
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching business data.')
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
    const { type, ...data } = body
    const { key: idempotencyKey, invalid } = readIdempotencyKey(request)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    if (type === 'clients') {
      const parsedBody = businessClientSchema.safeParse(data)
      if (!parsedBody.success) {
        return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
      }

      const result = await runIdempotentCreate(prisma, {
        userId: session.user.id,
        scope: 'business_client_create',
        idempotencyKey,
        fingerprint: createMutationFingerprint({ type, ...parsedBody.data }),
        resourceType: 'business_client',
        create: (db) => db.businessClient.create({
          data: { ...parsedBody.data, userId: session.user.id },
        }),
        findResource: (resourceId, db) => db.businessClient.findFirst({
          where: { id: resourceId, userId: session.user.id },
        }),
      })

      const response = NextResponse.json(result.resource, { status: result.replay ? 200 : 201 })
      response.headers.set('X-Idempotent-Replay', String(result.replay))
      return response
    } else if (type === 'content') {
      const parsedBody = businessContentIdeaSchema.safeParse(data)
      if (!parsedBody.success) {
        return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
      }

      const result = await runIdempotentCreate(prisma, {
        userId: session.user.id,
        scope: 'business_content_create',
        idempotencyKey,
        fingerprint: createMutationFingerprint({ type, ...parsedBody.data }),
        resourceType: 'business_content_idea',
        create: (db) => db.businessContentIdea.create({
          data: { ...parsedBody.data, userId: session.user.id },
        }),
        findResource: (resourceId, db) => db.businessContentIdea.findFirst({
          where: { id: resourceId, userId: session.user.id },
        }),
      })

      const response = NextResponse.json(result.resource, { status: result.replay ? 200 : 201 })
      response.headers.set('X-Idempotent-Replay', String(result.replay))
      return response
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating business data.')
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
    const type = searchParams.get('type')

    if (!id || !type) {
      return NextResponse.json({ error: 'ID and type are required' }, { status: 400 })
    }

    if (type === 'clients') {
      await prisma.businessClient.deleteMany({
        where: { id, userId: session.user.id }
      })
    } else if (type === 'content') {
      await prisma.businessContentIdea.deleteMany({
        where: { id, userId: session.user.id }
      })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business data.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
