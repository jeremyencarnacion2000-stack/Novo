import { NextResponse } from 'next/server';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const ytmusic = await getYTMusic();
    const songs = await ytmusic.searchSongs(q);
    
    // Map to CurrentTrack format
    const tracks = songs.slice(0, limit).map((song: any) => {
      const imageUrl = song.thumbnails?.[song.thumbnails.length - 1]?.url || '';
      return {
        id: song.videoId,
        uri: song.videoId,
        name: song.name || 'Unknown Track',
        artist: song.artist?.name || 'Unknown Artist',
        artistId: song.artist?.artistId || '',
        albumId: song.album?.albumId || '',
        image: imageUrl,
        album: {
          id: song.album?.albumId || '',
          name: song.album?.name || '',
          images: [{ url: imageUrl }]
        },
        duration_ms: (song.duration || 0) * 1000,
      };
    });
    
    return NextResponse.json({ tracks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
