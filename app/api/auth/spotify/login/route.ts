import { NextRequest } from 'next/server';

function getSpotifyAuthUrl(): string | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    console.log('SPOTIFY_CLIENT_ID not configured');
    return null;
  }

  const baseUrl = 'https://novo-desktop-mvp.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
  const scopes = 'user-read-email user-read-private playlist-read-private user-library-read user-read-playback-state';

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log('Spotify auth URL:', authUrl);
  return authUrl;
}

export async function GET(request: NextRequest) {
  const authUrl = getSpotifyAuthUrl();

  if (!authUrl) {
    return new Response(JSON.stringify({ error: 'Spotify client ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Use manual redirect with Response
  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl,
    },
  });
}

export async function POST(request: NextRequest) {
  const authUrl = getSpotifyAuthUrl();

  if (!authUrl) {
    return new Response(JSON.stringify({ error: 'Spotify client ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl,
    },
  });
}
