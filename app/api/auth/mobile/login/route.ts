import { NextResponse } from 'next/server'

// See the Google route beside this file. Password-to-JWT mobile sessions are
// intentionally unavailable until a native client can consume a short-lived,
// server-verified session through an OS-owned browser handoff.
export async function POST() {
  return NextResponse.json(
    {
      error: 'MobileAuthDeprecated',
      message: 'Use the Novo browser sign-in flow. Native OAuth return support is not released yet.',
    },
    { status: 410 },
  )
}
