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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const playlists = await prisma.musicPlaylist.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(playlists)
  } catch {
    console.error('[music/playlists] list failed')
    return NextResponse.json({ error: 'Unable to load playlists right now' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { name, description, tracks } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }

    const { key: idempotencyKey, invalid } = readIdempotencyKey(req)
    if (invalid) return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })

    const playlistData = {
      name: String(name).trim(),
      description: description ?? null,
      tracks: tracks || [],
      userId: user.id,
    }
    const result = await runIdempotentCreate(prisma, {
      userId: user.id,
      scope: 'music_playlist_create',
      idempotencyKey,
      fingerprint: createMutationFingerprint(playlistData),
      resourceType: 'music_playlist',
      create: (db) => db.musicPlaylist.create({ data: playlistData }),
      findResource: (resourceId, db) => db.musicPlaylist.findFirst({
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
    console.error('[music/playlists] create failed')
    return NextResponse.json({ error: 'Unable to create playlist right now' }, { status: 500 })
  }
}
