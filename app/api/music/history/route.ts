import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createMutationFingerprint,
  IdempotencyConflictError,
  readIdempotencyKey,
  runIdempotentCreate,
} from '@/lib/server-idempotency'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trackId, title, artist, artistId, thumbnail } = await req.json()

    if (!trackId || !title || !artist) {
      return NextResponse.json({ error: 'Missing track data' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { key: idempotencyKey, invalid } = readIdempotencyKey(req)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    const historyData = { userId: user.id, trackId, title, artist, artistId, thumbnail }
    const result = await runIdempotentCreate(prisma, {
      userId: user.id,
      scope: 'music_history_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(historyData),
      resourceType: 'music_history',
      create: (db) => db.musicHistory.create({ data: historyData }),
      findResource: (resourceId, db) => db.musicHistory.findFirst({
        where: { id: resourceId, userId: user.id },
      }),
    })

    return NextResponse.json(result.resource, {
      status: result.replay ? 200 : 201,
      headers: { 'X-Idempotent-Replay': String(result.replay) },
    })
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[music/history] save failed')
    return NextResponse.json({ error: 'Unable to save listening history right now' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const history = await prisma.musicHistory.findMany({
      where: { userId: user.id },
      orderBy: { playedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(history)
  } catch {
    console.error('[music/history] list failed')
    return NextResponse.json({ error: 'Unable to load listening history right now' }, { status: 500 })
  }
}
