import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAccessToken } from '@/lib/google';
import { getMyChannel, getMyPlaylists, getLikedVideos, getSubscriptions } from '@/lib/youtube-music';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // YouTube OAuth credentials are resolved from the server-owned Google
    // account row. They are never copied into the browser session payload.
    const token = await getGoogleAccessToken(session.user.id, ['youtube.readonly']);

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
  } catch {
    console.error('[YouTube] Account request failed.');
    return NextResponse.json({ error: 'YouTube account temporarily unavailable' }, { status: 500 });
  }
}
