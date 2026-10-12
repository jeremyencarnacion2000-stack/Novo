import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const followArtistSchema = z.object({
  artistId: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(300).optional(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  action: z.enum(['follow', 'unfollow']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = followArtistSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid follow request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { artistId, artistName, imageUrl, action } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'follow') {
      await prisma.musicArtist.upsert({
        where: {
          userId_artistId: {
            userId: user.id,
            artistId: artistId,
          },
        },
        update: {
          name: artistName || 'Unknown artist',
          imageUrl: imageUrl,
        },
        create: {
          userId: user.id,
          artistId: artistId,
          name: artistName || 'Unknown artist',
          imageUrl: imageUrl,
        },
      });
      return NextResponse.json({ success: true, message: 'Followed artist' });
    } else {
      await prisma.musicArtist.deleteMany({
        where: {
          userId: user.id,
          artistId: artistId,
        },
      });
      return NextResponse.json({ success: true, message: 'Unfollowed artist' });
    }
  } catch (error: any) {
    console.error('[MUSIC_FOLLOW_API_ERROR]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: {
            followedArtists: {
                orderBy: { followedAt: 'desc' }
            }
          }
        });
    
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
    
        return NextResponse.json(user.followedArtists);
      } catch (error: any) {
        console.error('[MUSIC_FOLLOW_GET_API_ERROR]');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
}
