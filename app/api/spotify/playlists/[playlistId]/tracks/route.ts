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

export async function GET(request: NextRequest, { params }: { params: Promise<{ playlistId: string }> }) {
    try {
        const accessToken = await getSpotifyToken(request);
        const { playlistId } = await params;

        if (!accessToken) {
            return NextResponse.json({ error: 'No Spotify access token found' }, { status: 401 });
        }

        const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Spotify playlist tracks API error:', errorData);
            return NextResponse.json({ error: 'Spotify API error', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching Spotify playlist tracks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ playlistId: string }> }) {
    try {
        const accessToken = await getSpotifyToken(request);
        const { playlistId } = await params;

        if (!accessToken) {
            return NextResponse.json({ error: 'No Spotify access token found' }, { status: 401 });
        }

        const body = await request.json();
        const { uris } = body;

        if (!uris || !Array.isArray(uris) || uris.length === 0) {
            return NextResponse.json({ error: 'Invalid request body: uris array is required' }, { status: 400 });
        }

        const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Spotify add tracks API error:', errorData);
            return NextResponse.json({ error: 'Spotify API error', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error adding tracks to Spotify playlist:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
