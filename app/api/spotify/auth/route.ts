import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = '5034558b7e60460d90d61876ae407dbf'
const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://astabot.netlify.app/auth/callback'
  : 'http://localhost:3000/api/spotify/callback'

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-library-modify',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private'
].join(' ')

export async function GET() {
  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('state', 'spotify_auth')

  return NextResponse.redirect(authUrl.toString())
}