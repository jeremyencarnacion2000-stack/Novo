import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '6148e790e2c64c03b671c7d04948c4e0'
const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://novo-desktop-mvp.vercel.app/api/spotify/callback'
  : 'http://localhost:3000/api/spotify/callback'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('Código recibido en callback:', code)
  console.log('Error recibido en callback:', error)
  console.log('Redirect URI esperado en callback:', REDIRECT_URI)

  if (error) {
    return NextResponse.redirect(new URL('/music?error=access_denied', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/music?error=no_code', request.url))
  }

  try {
    console.log('Intercambio de token iniciado con código:', code)

    // Exchange code for access token directly with Spotify
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    })

    const tokenData = await tokenResponse.json()

    console.log('Respuesta de token de Spotify:', tokenData)

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData)
      return NextResponse.redirect(new URL('/music?error=token_exchange_failed', request.url))
    }

    // Create redirect response and set httpOnly cookies for security
    const redirectResponse = NextResponse.redirect(new URL('/music?t=' + Date.now(), request.url))
    const expiresAt = Date.now() + (tokenData.expires_in * 1000)

    redirectResponse.cookies.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: tokenData.expires_in
    })

    redirectResponse.cookies.set('spotify_token_expires_at', expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: tokenData.expires_in
    })

    redirectResponse.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return redirectResponse
  } catch (err) {
    console.error('Auth callback error:', err)
    return NextResponse.redirect(new URL('/music?error=server_error', request.url))
  }
}