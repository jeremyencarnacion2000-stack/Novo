import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function getSpotifyToken(request: NextRequest): Promise<string | null> {
  // First check cookies (our custom auth flow)
  const rawCookieToken = request.cookies.get('spotify_access_token')?.value;
  if (rawCookieToken) {
    // Decode URL-encoded token
    return decodeURIComponent(rawCookieToken);
  }

  // Fallback to NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.accessToken && session.provider === 'spotify') {
    return session.accessToken as string;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getSpotifyToken(request);

    if (!accessToken) {
      return NextResponse.json({ error: 'No Spotify access token found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';

    const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify playlists API error:', errorData);
      return NextResponse.json({ error: 'Spotify API error', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Spotify playlists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
