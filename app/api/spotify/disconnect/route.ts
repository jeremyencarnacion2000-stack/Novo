import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (session?.user?.id) {
            // Remove Spotify account from database
            await prisma.account.deleteMany({
                where: {
                    userId: session.user.id,
                    provider: 'spotify'
                }
            });
            console.log(`Deleted Spotify account for user ${session.user.id}`);
        }

        // Create response
        const response = NextResponse.json({ success: true, message: 'Spotify disconnected' });

        // Clear Spotify cookies (if any were used outside of next-auth)
        response.cookies.set('spotify_access_token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        response.cookies.set('spotify_refresh_token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        return response;
    } catch (error) {
        console.error('Error disconnecting Spotify:', error);
        return NextResponse.json({ error: 'Failed to disconnect Spotify' }, { status: 500 });
    }
}
