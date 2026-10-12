import { NextRequest, NextResponse } from 'next/server'
import { retainAiActivity } from '@/lib/ai/activity-retention'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const now = new Date()
    const utcDayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const signalCutoff = new Date(utcDayStart - 30 * 24 * 60 * 60 * 1000)
    const [aiRetention, summaries, signals] = await Promise.all([
      retainAiActivity(),
      prisma.companionActivityDailySummary.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.novoSignalLedger.deleteMany({
        where: {
          source: 'device',
          signalType: { in: ['active_time_daily', 'app_usage_daily'] },
          sourceRef: { startsWith: 'daily:' },
          observedAt: { lte: signalCutoff },
        },
      }),
    ])
    return NextResponse.json({ activityRetention: aiRetention, companion: { summariesDeleted: summaries.count, signalsDeleted: signals.count } })
  }
  catch { return NextResponse.json({ error: 'Retention failed' }, { status: 500 }) }
}
