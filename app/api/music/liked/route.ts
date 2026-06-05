import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const { trackId, action, title, artist, artistId, album, thumbnail, duration } = await req.json()

    if (action === 'add') {
      const liked = await prisma.likedTrack.upsert({
        where: {
          userId_trackId: {
            userId: user.id,
            trackId,
          }
        },
        create: {
          userId: user.id,
          trackId,
          title,
          artist,
          artistId,
          album,
          thumbnail,
          duration,
        },
        update: {} // No change needed if it already exists
      })
      return NextResponse.json(liked)
    } else if (action === 'remove') {
      await prisma.likedTrack.deleteMany({
        where: {
          userId: user.id,
          trackId,
        }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Liked Tracks API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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

    const likedTracks = await prisma.likedTrack.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(likedTracks)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

