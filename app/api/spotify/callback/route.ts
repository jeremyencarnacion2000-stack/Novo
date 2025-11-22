import { NextRequest, NextResponse } from 'next/server'

const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://astabot.netlify.app/auth/callback'
  : 'http://localhost:3000/api/spotify/callback'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/music?error=access_denied', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/music?error=no_code', request.url))
  }

  try {
    // Exchange code for access token via token endpoint
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/spotify/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/music?error=token_exchange_failed', request.url))
    }

    // Redirect to music page on success
    return NextResponse.redirect(new URL('/music', request.url))
  } catch (err) {
    console.error('Auth callback error:', err)
    return NextResponse.redirect(new URL('/music?error=server_error', request.url))
  }
}