import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params
    const { name, description, tracks } = await req.json()

    const playlist = await prisma.musicPlaylist.update({
      where: { id, userId: user.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(tracks && { tracks }),
      }
    })

    return NextResponse.json(playlist)
  } catch {
    console.error('[music/playlist] read failed')
    return NextResponse.json({ error: 'Unable to load playlist right now' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params
    await prisma.musicPlaylist.delete({
      where: { id, userId: user.id }
    })

    return NextResponse.json({ success: true })
  } catch {
    console.error('[music/playlist] update failed')
    return NextResponse.json({ error: 'Unable to update playlist right now' }, { status: 500 })
  }
}
