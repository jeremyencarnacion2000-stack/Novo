import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // First check for Spotify cookies (our custom auth flow)
    const cookieStore = await cookies();
    const spotifyAccessToken = cookieStore.get('spotify_access_token')?.value;

    if (spotifyAccessToken) {
      // Verify token is still valid by checking user profile
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        const isPremium = userData.product === 'premium';

        console.log('DEBUG: Spotify user (cookie auth):', userData.display_name, '- isPremium:', isPremium);

        return NextResponse.json({
          hasToken: true,
          isPremium
        });
      }
    }

    // Fallback to NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || session.provider !== 'spotify') {
      return NextResponse.json({
        hasToken: false,
        isPremium: false,
        provider: session?.provider || 'none'
      });
    }

    // Fetch user profile to check product type
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        hasToken: true,
        isPremium: false
      });
    }

    const userData = await response.json();
    const isPremium = userData.product === 'premium';

    console.log('DEBUG: Spotify user (session auth):', userData.display_name, '- isPremium:', isPremium);

    return NextResponse.json({
      hasToken: true,
      isPremium
    });
  } catch (error) {
    console.error('Error checking Spotify token:', error);
    return NextResponse.json({
      hasToken: false,
      isPremium: false
    });
  }
}
