import { NextRequest, NextResponse } from 'next/server';

function createSpotifyAuthUrl(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  // Get the actual URL from the request headers
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
  const scopes = 'user-read-email user-read-private playlist-read-private user-library-read user-read-playback-state';

  console.log('Spotify redirect URI:', redirectUri);

  return `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function GET(request: NextRequest) {
  const authUrl = createSpotifyAuthUrl(request);
  if (!authUrl) {
    return NextResponse.json({ error: 'Spotify client ID not configured' }, { status: 500 });
  }
  return NextResponse.redirect(authUrl);
}

export async function POST(request: NextRequest) {
  const authUrl = createSpotifyAuthUrl(request);
  if (!authUrl) {
    return NextResponse.json({ error: 'Spotify client ID not configured' }, { status: 500 });
  }
  return NextResponse.redirect(authUrl);
}
