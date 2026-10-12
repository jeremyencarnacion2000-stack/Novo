import { NextResponse } from 'next/server'

// This endpoint previously minted a standalone 30-day JWT. Novo's protected
// APIs authenticate through the server-owned NextAuth session, so that token
// could not safely act as a mobile session and created a false integration
// path. Native clients must use system-browser OAuth and the verified return
// flow documented in docs/platform-port-readiness.md.
export async function POST() {
  return NextResponse.json(
    {
      error: 'MobileAuthDeprecated',
      message: 'Use the Novo browser sign-in flow. Native OAuth return support is not released yet.',
    },
    { status: 410 },
  )
}
