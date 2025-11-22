import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const CLIENT_SECRET = '6148e790e2c64c03b671c7d04948c4e0'
const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://astabot.netlify.app/auth/callback'
  : 'http://localhost:3000/api/spotify/callback'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('spotify_access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  return NextResponse.json({ access_token: accessToken })
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
    }

    // Exchange code for access token
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

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData)
      return NextResponse.json({ error: 'Token exchange failed' }, { status: tokenResponse.status })
    }

    // Set httpOnly cookies for security
    const response = NextResponse.json({ success: true })

    response.cookies.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in
    })

    response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return response
  } catch (err) {
    console.error('Token exchange error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}