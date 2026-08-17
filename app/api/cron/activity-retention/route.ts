import { NextRequest, NextResponse } from 'next/server'
import { retainAiActivity } from '@/lib/ai/activity-retention'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { return NextResponse.json(await retainAiActivity()) }
  catch { return NextResponse.json({ error: 'Retention failed' }, { status: 500 }) }
}
