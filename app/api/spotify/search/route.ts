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
                error: 'Unauthorized - Please connect your Spotify account',
                tracks: { items: [] }
            }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'track,artist,album,playlist';
        const limit = searchParams.get('limit') || '20';

        if (!query) {
            return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }

        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Spotify search error:', response.status, errorData);
            return NextResponse.json({
                error: 'Failed to search Spotify',
                tracks: { items: [] }
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error searching Spotify:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            tracks: { items: [] }
        }, { status: 500 });
    }
}
