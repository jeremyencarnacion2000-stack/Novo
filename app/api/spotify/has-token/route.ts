import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is authenticated with Spotify specifically
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

    console.log('DEBUG: Spotify user type:', userData.product, '- isPremium:', isPremium);

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
