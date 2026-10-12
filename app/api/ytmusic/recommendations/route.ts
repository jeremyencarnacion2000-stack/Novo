import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const seed_tracks = searchParams.get('seed_tracks');
  const seed_artists = searchParams.get('seed_artists');
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  // Recommendations are a compact context signal. Keep the provider and the
  // browser response bounded even when a stale client or a crafted URL sends
  // an unexpectedly large value.
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20

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
      } catch {
        console.warn('[ytmusic/recommendations] Artist fallback unavailable.')
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

    // A provider fallback can overlap the up-next queue. Preserve the first
    // occurrence of each track so the player never renders duplicate
    // recommendations or emits the same signal twice in one response.
    const seenTrackIds = new Set<string>();
    const uniqueTracks = tracks.filter((track: any) => {
      const id = String(track?.id || track?.uri || '');
      if (!id || seenTrackIds.has(id)) return false;
      seenTrackIds.add(id);
      return true;
    });

    return NextResponse.json({ tracks: uniqueTracks.slice(0, limit) });
  } catch {
    console.error('[ytmusic/recommendations] request failed')
    return NextResponse.json({ error: 'Music recommendations temporarily unavailable' }, { status: 500 });
  }
}
