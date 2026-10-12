import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ytmusic = await getYTMusic();
    
    // Top hits to represent trending tracks
    const hits = await ytmusic.searchSongs("top hits 2024");
    const topTracks = hits.slice(0, 20).map((song: any) => ({
      id: song.videoId,
      uri: song.videoId,
      name: song.name,
      artists: [{ name: song.artist.name, id: song.artist.artistId }],
      album: { 
        id: song.album?.albumId, 
        name: song.album?.name,
        images: [{url: song.thumbnails?.[song.thumbnails.length - 1]?.url || ''}]
      },
      duration_ms: (song.duration || 0) * 1000,
    }));

    // Mood mixes
    const moodRes = await ytmusic.searchPlaylists("mood mix");
    const moodMixes = moodRes.slice(0, 10).map((p: any) => ({
      id: p.playlistId,
      name: p.name,
      images: [{url: p.thumbnails?.[0]?.url || ''}],
      owner: { display_name: "YouTube Music" }
    }));

    return NextResponse.json({ 
        topTracks,
        moodMixes
    });
  } catch {
    console.error('[ytmusic/top] request failed')
    return NextResponse.json({ error: 'Music service temporarily unavailable' }, { status: 500 });
  }
}
