import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

    const playlist = await prisma.musicPlaylist.create({
      data: {
        name,
        description,
        tracks: tracks || [],
        userId: user.id,
      }
    })

    return NextResponse.json(playlist)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

