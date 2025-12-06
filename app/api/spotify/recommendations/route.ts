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
            return NextResponse.json({
                error: 'Unauthorized',
                tracks: []
            }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '20';

        // Get new releases as recommendations for users without listening history
        const newReleasesResponse = await fetch(`https://api.spotify.com/v1/browse/new-releases?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!newReleasesResponse.ok) {
            console.error('Failed to fetch new releases:', newReleasesResponse.status);
            // Try featured playlists as fallback
            const featuredResponse = await fetch(`https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (featuredResponse.ok) {
                const featuredData = await featuredResponse.json();
                return NextResponse.json({
                    type: 'featured_playlists',
                    message: featuredData.message || 'Featured Playlists',
                    playlists: featuredData.playlists?.items || []
                });
            }

            return NextResponse.json({
                error: 'Failed to fetch recommendations',
                tracks: []
            }, { status: 500 });
        }

        const newReleasesData = await newReleasesResponse.json();

        // Get tracks from the new releases albums
        const albums = newReleasesData.albums?.items || [];

        // Fetch tracks from each album (limited to first 5 albums)
        const trackPromises = albums.slice(0, 5).map(async (album: any) => {
            const tracksResponse = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=4`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (tracksResponse.ok) {
                const tracksData = await tracksResponse.json();
                return tracksData.items.map((track: any) => ({
                    ...track,
                    album: {
                        id: album.id,
                        name: album.name,
                        images: album.images
                    }
                }));
            }
            return [];
        });

        const tracksArrays = await Promise.all(trackPromises);
        const tracks = tracksArrays.flat();

        return NextResponse.json({
            type: 'new_releases',
            message: 'New Releases',
            albums: albums,
            tracks: tracks
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            tracks: []
        }, { status: 500 });
    }
}
