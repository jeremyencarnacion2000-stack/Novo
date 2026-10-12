import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20

  if (!q) {
    return NextResponse.json({ error: 'Missing q param' }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'Search query is too long' }, { status: 400 });
  }

  try {
    const ytmusic = await getYTMusic();

    // Primary: strict song search — only verified music catalog entries
    let tracks: any[] = [];
    try {
      const songs = await ytmusic.searchSongs(q);
      tracks = songs.slice(0, limit).map((song) => {
        const imageUrl = song.thumbnails?.[song.thumbnails.length - 1]?.url || '';
        return {
          id: song.videoId,
          uri: song.videoId,
          name: song.name ?? 'Unknown Track',
          artist: song.artist?.name ?? 'Unknown Artist',
          artistId: song.artist?.artistId ?? '',
          image: imageUrl,
          album: song.album?.name ?? '',
          albumId: song.album?.albumId ?? '',
          duration_ms: (song.duration ?? 0) * 1000,
        };
      });
    } catch {
      console.warn('[youtube/search] searchSongs failed, trying searchVideos.');
    }

    // Fallback: music videos if no songs returned
    if (tracks.length === 0) {
      try {
        const videos = await ytmusic.searchVideos(q);
        tracks = videos.slice(0, limit).map((video) => {
          const imageUrl = video.thumbnails?.[video.thumbnails.length - 1]?.url || '';
          return {
            id: video.videoId,
            uri: video.videoId,
            name: video.name ?? 'Unknown',
            artist: video.artist?.name ?? 'Unknown Artist',
            artistId: video.artist?.artistId ?? '',
            image: imageUrl,
            album: '',
            albumId: '',
            duration_ms: (video.duration ?? 0) * 1000,
          };
        });
      } catch {
        console.warn('[youtube/search] searchVideos fallback also failed.');
      }
    }

    return NextResponse.json({ tracks });
  } catch {
    console.error('[youtube/search] Critical error.');
    return NextResponse.json({ error: 'Video search temporarily unavailable' }, { status: 500 });
  }
}
