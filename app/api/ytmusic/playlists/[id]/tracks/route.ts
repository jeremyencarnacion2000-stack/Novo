import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const p = await params;
  const playlistId = p.id;
  
  if (!playlistId) {
    return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
  }

  try {
    const ytmusic = await getYTMusic();
    const playlist = await ytmusic.getPlaylistVideos(playlistId);
    
    // Map to SpotifyTrack shape temporarily for frontend compatibility
    // Or just a standardized object that frontend understands
    const tracks = playlist.map((song: any) => ({
      track: {
        id: song.videoId,
        uri: song.videoId,
        name: song.name,
        artist: song.artists?.[0]?.name || 'Unknown',
        artistId: song.artists?.[0]?.artistId || '',
        artists: song.artists?.map((a:any) => ({ name: a.name, id: a.artistId })) || [],
        album: { 
            images: [{url: song.thumbnails?.[song.thumbnails.length - 1]?.url || ''}] 
        },
        duration_ms: (song.duration || 0) * 1000,
      }
    }));
    
    return NextResponse.json({ items: tracks });
  } catch {
    console.error('[ytmusic/playlist-tracks] request failed')
    return NextResponse.json({ error: 'Playlist tracks temporarily unavailable' }, { status: 500 });
  }
}
