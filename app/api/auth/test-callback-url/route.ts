import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get the base URL from NEXTAUTH_URL or construct from request
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin

    // Construct the callback URL that NextAuth generates for Google OAuth
    const callbackUrl = `${baseUrl}/api/auth/callback/google`

    return NextResponse.json({
      provider: 'google',
      callbackUrl,
      baseUrl,
      nextauthUrl: process.env.NEXTAUTH_URL || null,
      constructedFrom: process.env.NEXTAUTH_URL ? 'NEXTAUTH_URL' : 'request.origin'
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate callback URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}