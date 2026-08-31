import { NextRequest, NextResponse } from 'next/server'
import { refreshAmbientContextForAllUsers } from '@/lib/cognitive/ambient-context-refresh'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Protected recurring refresh for authorized, read-only Twin sources. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json({ success: true, ...(await refreshAmbientContextForAllUsers()) })
  } catch {
    console.error('[Cron: ambient-context] Refresh failed.')
    return NextResponse.json({ error: 'Ambient refresh failed' }, { status: 500 })
  }
}
