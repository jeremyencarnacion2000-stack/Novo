import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPlaylistTracks } from '@/lib/youtube-music';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const tracks = await getPlaylistTracks(token, id);
    return NextResponse.json({ tracks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
