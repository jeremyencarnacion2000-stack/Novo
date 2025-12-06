import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || session.provider !== 'spotify') {
      return NextResponse.json({
        error: 'Not authenticated with Spotify. Please sign in with Spotify.',
        provider: session?.provider || 'none'
      }, { status: 401 });
    }

    const url = 'https://api.spotify.com/v1/me';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`
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
