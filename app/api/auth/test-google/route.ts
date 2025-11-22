import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    const isConfigured = !!(clientId && clientSecret)

    return NextResponse.json({
      provider: 'google',
      configured: isConfigured,
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      status: isConfigured ? 'ready' : 'missing_credentials'
    })
  } catch (error) {
    return NextResponse.json(
      {
        provider: 'google',
        configured: false,
        error: 'Configuration check failed',
        status: 'error'
      },
      { status: 500 }
    )
  }
}