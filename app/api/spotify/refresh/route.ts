import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''

export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value

  console.log('POST /api/spotify/refresh: Refresh token exists:', !!refreshToken)

  if (!refreshToken) {
    console.log('POST /api/spotify/refresh: No refresh token found, returning 401')
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    console.log('POST /api/spotify/refresh: Attempting to refresh token')
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const data = await response.json()

    console.log('POST /api/spotify/refresh: Spotify response status:', response.status)
    console.log('POST /api/spotify/refresh: Response data:', data)

    if (!response.ok) {
      console.log('POST /api/spotify/refresh: Failed to refresh token, status:', response.status)
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: response.status })
    }

    console.log('POST /api/spotify/refresh: Token refreshed successfully, updating cookies')

    // Update cookies
    const res = NextResponse.json({ access_token: data.access_token })

    res.cookies.set('spotify_access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: data.expires_in
    })

    if (data.refresh_token) {
      res.cookies.set('spotify_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    return res
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}