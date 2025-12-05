import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                'Authorization': `Bearer ${session.accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch search results');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error searching Spotify:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
