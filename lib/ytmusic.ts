import YTMusic from 'ytmusic-api';

// ── Singleton YTMusic instance ──────────────────────────────────────────────
let ytmusic: YTMusic | null = null;
let initPromise: Promise<void> | null = null;

export async function getYTMusic(): Promise<YTMusic> {
  if (ytmusic) return ytmusic;
  if (!initPromise) {
    ytmusic = new YTMusic();
    initPromise = ytmusic.initialize().then(() => {}).catch((e: any) => {
      ytmusic = null;
      initPromise = null;
      throw e;
    });
  }
  await initPromise;
  return ytmusic!;
}

// ── Normalised internal types ──────────────────────────────────────────────
// These are the shapes the frontend and API routes should rely on.

export interface MusicTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  artistId: string;
  image: string;
  album: string;
  albumId: string;
  duration_ms: number;
  /** Array form — used by some components for multi-artist display */
  artists: { name: string; id: string }[];
}

export interface MusicArtist {
  id: string;
  name: string;
  image: string;
  isFollowed: boolean;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  owner: string;
  image: string;
  trackCount: number;
}

// ── Re-export library types that callers may need directly ─────────────────
export type {
  SongDetailed,
  SongFull,
  ArtistDetailed,
  ArtistFull,
  AlbumDetailed,
  VideoDetailed,
  PlaylistDetailed,
  SearchResult,
} from 'ytmusic-api';

// ── Legacy interface stubs (kept for compatibility with existing pages) ─────
export interface YTMusicTrack extends MusicTrack {}

export interface YTPlaylistResponse {
  playlistId: string;
  name: string;
  artist?: { name: string; artistId: string };
  thumbnails: { url: string; width: number; height: number }[];
  songs?: any[];
}
