import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMyChannel, getMyPlaylists, getLikedVideos, getSubscriptions } from '@/lib/youtube-music';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated with YouTube' }, { status: 401 });
    }

    const [channel, playlists, liked, subs] = await Promise.allSettled([
      getMyChannel(token),
      getMyPlaylists(token),
      getLikedVideos(token),
      getSubscriptions(token),
    ]);

    return NextResponse.json({
      channel: channel.status === 'fulfilled' ? channel.value : null,
      playlists: playlists.status === 'fulfilled' ? playlists.value : [],
      likedTracks: liked.status === 'fulfilled' ? liked.value : [],
      subscriptions: subs.status === 'fulfilled' ? subs.value : [],
    });
  } catch (error: any) {
    console.error('YouTube Account API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
