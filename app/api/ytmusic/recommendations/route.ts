import { NextResponse } from 'next/server';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seed_tracks = searchParams.get('seed_tracks');
  const seed_artists = searchParams.get('seed_artists');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    const ytmusic = await getYTMusic();
    let tracks: any[] = [];

    // 1. Primary Strategy: getUpNexts based on a track ID
    if (seed_tracks) {
      const videoId = seed_tracks.split(',')[0];
      if (videoId && videoId.length === 11) {
        const upNext = await ytmusic.getUpNexts(videoId);
        tracks = upNext.slice(1, limit + 1).map((song: any) => ({
          id: song.videoId,
          uri: song.videoId,
          name: song.title || song.name,
          artist: song.artists?.[0]?.name || song.artist?.name || 'Unknown Artist',
          artistId: song.artists?.[0]?.artistId || song.artist?.artistId,
          albumId: song.album?.albumId,
          image: song.thumbnails?.[song.thumbnails.length - 1]?.url || '',
          duration_ms: (song.duration || 0) * 1000,
        }));
      }
    }

    // 2. Secondary Strategy: Mix in Artist-based tracks if available
    if (seed_artists && (tracks.length < limit / 2)) {
      const artistId = seed_artists.split(',')[0];
      try {
        const artist = await ytmusic.getArtist(artistId);
        const artistTracks = (artist as any).topSongs || [];
        const additional = artistTracks.slice(0, 5).map((song: any) => ({
          id: song.videoId,
          uri: song.videoId,
          name: song.name,
          artist: artist.name,
          artistId: artist.artistId,
          albumId: song.album?.albumId,
          image: song.thumbnails?.[song.thumbnails.length - 1]?.url || '',
          duration_ms: (song.duration || 0) * 1000,
        }));
        
        // INTERLEAVE: Mix them in!
        tracks = [...tracks, ...additional].sort(() => Math.random() - 0.5);
      } catch (e) {
        console.warn(`Could not fetch artist tracks for ${artistId}:`, e);
      }
    }

    // 3. Last Resort: Generic top hits fallback
    if (tracks.length === 0) {
      const fallbackQuery = "trending songs 2024 hits";
      const songs = await ytmusic.searchSongs(fallbackQuery);
      tracks = songs.slice(0, limit).map((song: any) => ({
        id: song.videoId,
        uri: song.videoId,
        name: song.name,
        artist: song.artist?.name || 'Unknown Artist',
        artistId: song.artist?.artistId,
        albumId: song.album?.albumId,
        image: song.thumbnails?.[song.thumbnails.length - 1]?.url || '',
        duration_ms: (song.duration || 0) * 1000,
      }));
    }

    return NextResponse.json({ tracks: tracks.slice(0, limit) });
  } catch (error: any) {
    console.error("Recommendations API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
