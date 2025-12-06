import { NextRequest, NextResponse } from 'next/server';

function createSpotifyAuthUrl(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  // Use stable production domain or localhost for development
  const host = request.headers.get('host') || 'localhost:3000';
  let baseUrl: string;

  if (host.includes('localhost')) {
    baseUrl = 'http://localhost:3000';
  } else {
    // Use stable Vercel domain that's registered in Spotify
    baseUrl = 'https://novo-desktop-mvp.vercel.app';
  }

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
