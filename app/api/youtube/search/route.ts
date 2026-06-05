import { NextResponse } from 'next/server';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  if (!q) {
    return NextResponse.json({ error: 'Missing q param' }, { status: 400 });
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
    } catch (songErr) {
      console.warn('[youtube/search] searchSongs failed, trying searchVideos:', songErr);
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
      } catch (videoErr) {
        console.warn('[youtube/search] searchVideos fallback also failed:', videoErr);
      }
    }

    return NextResponse.json({ tracks });
  } catch (error: any) {
    console.error('[youtube/search] Critical error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
