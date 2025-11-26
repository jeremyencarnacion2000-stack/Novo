import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '6148e790e2c64c03b671c7d04948c4e0'

async function refreshAccessToken(cookieStore: any) {
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value

  if (!refreshToken) {
    throw new Error('No refresh token')
  }

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

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  // Update cookies
  const expiresAt = Date.now() + (data.expires_in * 1000)

  cookieStore.set('spotify_access_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: data.expires_in
  })

  cookieStore.set('spotify_token_expires_at', expiresAt.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: data.expires_in
  })

  if (data.refresh_token) {
    cookieStore.set('spotify_refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
  }

  return data.access_token
}

export async function GET() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('spotify_access_token')?.value
  const expiresAt = cookieStore.get('spotify_token_expires_at')?.value

  console.log('GET /api/spotify/token: Access token exists:', !!accessToken)
  console.log('GET /api/spotify/token: Expires at:', expiresAt)

  if (!accessToken) {
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value
    if (refreshToken) {
      try {
        accessToken = await refreshAccessToken(cookieStore)
        console.log('GET /api/spotify/token: Token refreshed successfully (missing access token)')
      } catch (error) {
        console.error('GET /api/spotify/token: Failed to refresh token (missing access token):', error)
        return NextResponse.json({ error: 'No access token and refresh failed' }, { status: 401 })
      }
    } else {
      console.log('GET /api/spotify/token: No access token and no refresh token, returning 401')
      return NextResponse.json({ error: 'No access token' }, { status: 401 })
    }
  }

  // Check if token is expired
  if (expiresAt && Date.now() > parseInt(expiresAt)) {
    console.log('GET /api/spotify/token: Token expired, attempting refresh')
    try {
      accessToken = await refreshAccessToken(cookieStore)
      console.log('GET /api/spotify/token: Token refreshed successfully')
    } catch (error) {
      console.error('GET /api/spotify/token: Failed to refresh token:', error)
      return NextResponse.json({ error: 'Token expired and refresh failed' }, { status: 401 })
    }
  }

  console.log('GET /api/spotify/token: Returning access token')
  return NextResponse.json({ access_token: accessToken })
}