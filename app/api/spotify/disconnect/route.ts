import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Create response
        const response = NextResponse.json({ success: true, message: 'Spotify disconnected' });

        // Clear Spotify cookies
        response.cookies.set('spotify_access_token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 0 // Expire immediately
        });

        response.cookies.set('spotify_refresh_token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 0 // Expire immediately
        });

        return response;
    } catch (error) {
        console.error('Error disconnecting Spotify:', error);
        return NextResponse.json({ error: 'Failed to disconnect Spotify' }, { status: 500 });
    }
}
