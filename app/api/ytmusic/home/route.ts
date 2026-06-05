import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getYTMusic } from '@/lib/ytmusic';
import { prisma } from '@/lib/prisma';

// Verified curated artists — shown when user has no subscriptions or followed artists
const CURATED_ARTISTS = [
  { id: 'UCXP4sUCrHiR6_pS9sXPEXQg', name: 'Bad Bunny', image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop' },
  { id: 'UCYvmuw-JdgEUTgNd40yq4A',  name: 'Drake',    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop' },
  { id: 'UCqECaJ8Gagnn7YCbPEz9OIw', name: 'Taylor Swift', image: 'https://images.unsplash.com/photo-1549834185-bd9f078a5dfe?w=300&h=300&fit=crop' },
  { id: 'UC0WP5P-ufpbKb5QrNHrXy4A', name: 'The Weeknd',   image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop' },
  { id: 'UCDPM_n1atn2ijUwHd0g_g7A', name: 'Coldplay',     image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop' },
  { id: 'UCiGm_E4ZwYSHV3qb-kqACtA', name: 'Billie Eilish', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop' },
  { id: 'UC-J-u8uQc1P_n1c1mS-g_Tw', name: 'Dua Lipa',     image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop' },
  { id: 'UC0C-w0YjGpqDXGB8IHb662A', name: 'Ed Sheeran',   image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&h=300&fit=crop' },
];

// Discover queries — used to source trending/new tracks via ytmusic-api searchSongs
const DISCOVERY_QUERIES = [
  'top hits 2025',
  'new music this week',
  'viral songs 2025',
  'trending pop 2025',
];

export async function GET() {
  const session = await getServerSession(authOptions);

  try {
    const ytmusic = await getYTMusic();

    // ── 1. Top Tracks via ytmusic-api searchSongs (music-only, no video noise) ──
    const query = DISCOVERY_QUERIES[Math.floor(Math.random() * DISCOVERY_QUERIES.length)];
    let topTracks: any[] = [];
    try {
      const songs = await ytmusic.searchSongs(query);
      topTracks = songs.slice(0, 15).map((song) => {
        const imageUrl = song.thumbnails?.[song.thumbnails.length - 1]?.url || '';
        return {
          id: song.videoId,
          uri: song.videoId,
          name: song.name,
          artist: song.artist?.name ?? 'Unknown Artist',
          artistId: song.artist?.artistId ?? '',
          image: imageUrl,
          album: song.album?.name ?? '',
          duration_ms: (song.duration ?? 0) * 1000,
          artists: [{ name: song.artist?.name ?? 'Unknown Artist', id: song.artist?.artistId ?? '' }],
        };
      });
    } catch (err) {
      console.warn('[home] searchSongs failed, topTracks will be empty:', err);
    }

    // ── 2. Playlists via ytmusic-api searchPlaylists ──
    let playlists: any[] = [];
    try {
      const rawPlaylists = await ytmusic.searchPlaylists('top playlist 2025');
      playlists = rawPlaylists.slice(0, 10).map((pl) => {
        const imageUrl = pl.thumbnails?.[pl.thumbnails.length - 1]?.url || '';
        return {
          id: pl.playlistId,
          name: pl.name,
          owner: pl.artist?.name ?? 'YouTube Music',
          image: imageUrl,
          trackCount: 0,
        };
      });
    } catch (err) {
      console.warn('[home] searchPlaylists failed:', err);
    }

    // ── 3. Top Artists: DB-followed + curated fallback ──
    let dbFollowedArtists: any[] = [];
    if (session?.user?.email) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { followedArtists: true },
        });
        if (user?.followedArtists) {
          dbFollowedArtists = user.followedArtists.map((artist) => ({
            id: artist.artistId,
            name: artist.name,
            image: artist.imageUrl,
            isFollowed: true,
          }));
        }
      } catch (err) {
        console.warn('[home] DB followedArtists fetch failed:', err);
      }
    }

    // Build merged artists list: followed first, then curated backfill
    const seenIds = new Set<string>();
    const mergedArtists: any[] = [];

    for (const artist of dbFollowedArtists) {
      if (!seenIds.has(artist.id)) {
        seenIds.add(artist.id);
        mergedArtists.push(artist);
      }
    }
    for (const artist of CURATED_ARTISTS) {
      if (!seenIds.has(artist.id)) {
        seenIds.add(artist.id);
        mergedArtists.push({ ...artist, isFollowed: false });
      }
    }

    return NextResponse.json({
      topTracks,
      playlists,
      topArtists: mergedArtists.slice(0, 18),
    });
  } catch (error: any) {
    console.error('[home] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
