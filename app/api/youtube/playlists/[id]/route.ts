import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAccessToken } from '@/lib/google';
import { getPlaylistTracks } from '@/lib/youtube-music';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = await getGoogleAccessToken(session.user.id, ['youtube.readonly']);
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const tracks = await getPlaylistTracks(token, id);
    return NextResponse.json({ tracks });
  } catch {
    console.error('[youtube/playlist] request failed.')
    return NextResponse.json({ error: 'Playlist temporarily unavailable' }, { status: 500 });
  }
}
