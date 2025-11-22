import { NextResponse } from 'next/server'

export async function GET() {
  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://yourdomain.com/api/kilo/callback'
    : 'http://localhost:3000/api/kilo/callback'

  const authUrl = new URL('https://auth.kilo.ai/login')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', 'kilo_auth')

  return NextResponse.redirect(authUrl.toString())
}