import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { playlistId: string } }) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No Spotify access token found' }, { status: 401 });
        }

        const url = `https://api.spotify.com/v1/playlists/${params.playlistId}/tracks`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`
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
