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

    // Create a history entry
    const historyEntry = await prisma.musicHistory.create({
      data: {
        userId: user.id,
        trackId,
        title,
        artist,
        artistId,
        thumbnail,
      }
    })

    return NextResponse.json(historyEntry)
  } catch (error: any) {
    console.error('History API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
