import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Read cookies from the request directly
    const rawCookieToken = request.cookies.get('spotify_access_token')?.value;

    // URL decode the token (in case it was encoded)
    const spotifyAccessToken = rawCookieToken ? decodeURIComponent(rawCookieToken) : null;

    console.log('has-token: checking for Spotify token');
    console.log('has-token: cookie value exists:', !!spotifyAccessToken);
    console.log('has-token: token length:', spotifyAccessToken?.length || 0);

    if (spotifyAccessToken) {
      // Verify token is still valid by checking user profile
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`
        }
      });

      console.log('has-token: Spotify API response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        const isPremium = userData.product === 'premium';

        console.log('has-token: Spotify user verified:', userData.display_name, 'Product:', userData.product);

        return NextResponse.json({
          hasToken: true,
          isPremium,
          product: userData.product,
          accessToken: spotifyAccessToken
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('has-token: Cookie token invalid, status:', response.status, 'error:', errorData);
        return NextResponse.json({
          hasToken: false,
          isPremium: false,
          tokenExpired: true,
          spotifyError: errorData.error?.message || 'Unknown error',
          errorCode: 'INVALID_TOKEN'
        });
      }
    }

    // Fallback to NextAuth session
    const session = await getServerSession(authOptions);

    console.log('has-token: No cookie token, checking NextAuth session');
    console.log('has-token: session provider:', session?.provider);

    if (!session?.accessToken || session.provider !== 'spotify') {
      return NextResponse.json({
        hasToken: false,
        isPremium: false,
        provider: session?.provider || 'none'
      });
    }

    // Verify NextAuth token is still valid
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      console.log('has-token: NextAuth Spotify token invalid');
      return NextResponse.json({
        hasToken: false,
        isPremium: false,
        tokenExpired: true
      });
    }

    const userData = await response.json();
    const isPremium = userData.product === 'premium';

    console.log('has-token: NextAuth Spotify user verified:', userData.display_name);

    return NextResponse.json({
      hasToken: true,
      isPremium,
      product: userData.product,
      accessToken: session.accessToken
    });
  } catch (error) {
    console.error('has-token: Error:', error);
    return NextResponse.json({
      hasToken: false,
      isPremium: false,
      error: 'Internal server error'
    });
  }
}
