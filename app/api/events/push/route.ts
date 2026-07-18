import { NextRequest, NextResponse } from 'next/server'
import { pushEventToUser } from '@/lib/events-bus'

// Internal webhook — called by Inngest functions and server-side AI jobs
// to push real-time events to connected SSE clients.
//
// Protected by a shared secret (INNGEST_SIGNING_KEY or EVENTS_WEBHOOK_SECRET).
// NOT exposed to the public — add this to your Vercel environment variables.

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.EVENTS_WEBHOOK_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, type, payload } = await req.json()

  if (!userId || !type) {
    return NextResponse.json({ error: 'userId and type are required' }, { status: 400 })
  }

  pushEventToUser(userId, type, payload ?? {})

  return NextResponse.json({ ok: true })
}
