import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'

// One sanitized server-side event marks the beginning of the activation funnel.
// The client never sends user ownership or private onboarding answers.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await trackNovoLoopEvent(session.user.id, 'onboarding_started', { surface: 'onboarding' })
  return NextResponse.json({ ok: true })
}
