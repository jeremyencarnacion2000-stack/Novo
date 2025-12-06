import { NextRequest, NextResponse } from 'next/server';

function getSpotifyAuthUrl(): string | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  const baseUrl = 'https://novo-desktop-mvp.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
  const scopes = 'user-read-email user-read-private playlist-read-private user-library-read user-read-playback-state';

  console.log('Spotify redirect URI:', redirectUri);

  return `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function GET(request: NextRequest) {
  const authUrl = getSpotifyAuthUrl();
  if (!authUrl) {
    return NextResponse.json({ error: 'Spotify client ID not configured' }, { status: 500 });
  }

  // Use redirect with absolute URL
  return NextResponse.redirect(new URL(authUrl));
}

export async function POST(request: NextRequest) {
  const authUrl = getSpotifyAuthUrl();
  if (!authUrl) {
    return NextResponse.json({ error: 'Spotify client ID not configured' }, { status: 500 });
  }

  return NextResponse.redirect(new URL(authUrl));
}
