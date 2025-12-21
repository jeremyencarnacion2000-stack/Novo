// lib/spotify.ts
import { Session } from 'next-auth';

// Helper function to fetch data from Spotify Web API
export async function fetchSpotifyData(session: Session, endpoint: string) {
  if (!session || !session.accessToken || session.provider !== 'spotify') {
    throw new Error('Not authenticated with Spotify');
  }

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (response.status === 401) {
    // Token might be expired, next-auth should handle refresh.
    // If not, trigger re-authentication or prompt user to log in again.
    throw new Error('Spotify access token expired or invalid.');
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Spotify API error: ${response.status} - ${errorData.error.message}`);
  }

  return response.json();
}

// Type Definitions for Spotify API Responses (simplified for initial implementation)
export interface SpotifyUser {
  display_name: string;
  id: string;
  email: string;
  images: { url: string }[];
  external_urls: { spotify: string };
  uri: string;
  product?: string; // 'premium', 'free', 'open'
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  owner: { display_name: string };
  external_urls: { spotify: string };
  tracks: { total: number };
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: { name: string; images: { url: string }[] };
  external_urls: { spotify: string };
  uri: string;
  preview_url: string;
  duration_ms: number;
  popularity?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  external_urls: { spotify: string };
  uri: string;
}

export interface SpotifyPaging<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}
