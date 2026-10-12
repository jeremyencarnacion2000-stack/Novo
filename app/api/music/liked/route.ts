import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const likedTrackSchema = z.object({
  trackId: z.string().trim().min(1).max(300),
  action: z.enum(['add', 'remove']),
  title: z.string().trim().min(1).max(500).optional(),
  artist: z.string().trim().min(1).max(500).optional(),
  artistId: z.string().trim().max(300).optional().nullable(),
  album: z.string().trim().max(500).optional().nullable(),
  thumbnail: z.string().trim().max(2000).optional().nullable(),
  duration: z.number().int().min(0).max(86_400_000).optional().nullable(),
}).superRefine((value, context) => {
  if (value.action === 'add' && (!value.title || !value.artist)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['title'], message: 'title and artist are required when adding a track' })
  }
})

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

    const parsed = likedTrackSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid liked track request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { trackId, action, title, artist, artistId, album, thumbnail, duration } = parsed.data

    if (action === 'add') {
      // superRefine enforces these fields for adds; keep the explicit guard
      // here as a type-safe runtime boundary before writing to Prisma.
      if (!title || !artist) {
        return NextResponse.json({ error: 'title and artist are required when adding a track' }, { status: 400 })
      }
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
  } catch {
    console.error('[music/liked] update failed')
    return NextResponse.json({ error: 'Unable to update liked tracks right now' }, { status: 500 })
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
  } catch {
    console.error('[music/liked] list failed')
    return NextResponse.json({ error: 'Unable to load liked tracks right now' }, { status: 500 })
  }
}
