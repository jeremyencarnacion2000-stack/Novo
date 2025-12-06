import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getSpotifyToken(): Promise<string | null> {
  // First check cookies (our custom auth flow)
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('spotify_access_token')?.value;
  if (cookieToken) {
    return cookieToken;
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
    const accessToken = await getSpotifyToken();

    if (!accessToken) {
      return NextResponse.json({
        error: 'Not authenticated with Spotify',
        notConnected: true
      }, { status: 401 });
    }

    const url = 'https://api.spotify.com/v1/me';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify API error:', errorData);
      return NextResponse.json({ error: 'Spotify API error', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Spotify user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
