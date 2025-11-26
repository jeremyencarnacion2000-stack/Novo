import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '6148e790e2c64c03b671c7d04948c4e0'

async function getAccessToken(cookieStore: any) {
  let accessToken = cookieStore.get('spotify_access_token')?.value
  const expiresAt = cookieStore.get('spotify_token_expires_at')?.value

  if (!accessToken) {
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value
    if (refreshToken) {
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

      accessToken = data.access_token

      const newExpiresAt = Date.now() + (data.expires_in * 1000)

      cookieStore.set('spotify_access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: data.expires_in
      })

      cookieStore.set('spotify_token_expires_at', newExpiresAt.toString(), {
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
          maxAge: 60 * 60 * 24 * 30
        })
      }
    } else {
      throw new Error('No access token')
    }
  }

  if (expiresAt && Date.now() > parseInt(expiresAt)) {
    // Refresh token
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value
    if (refreshToken) {
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

      accessToken = data.access_token

      const newExpiresAt = Date.now() + (data.expires_in * 1000)

      cookieStore.set('spotify_access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: data.expires_in
      })

      cookieStore.set('spotify_token_expires_at', newExpiresAt.toString(), {
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
          maxAge: 60 * 60 * 24 * 30
        })
      }
    } else {
      throw new Error('Token expired and no refresh token')
    }
  }

  return accessToken
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
  }

  try {
    const cookieStore = await cookies()
    const accessToken = await getAccessToken(cookieStore)

    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to search tracks')
    }

    const data = await response.json()
    return NextResponse.json(data.tracks.items)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Failed to search tracks' }, { status: 500 })
  }
}