import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Real daily trend series for the Cognitive Metrics strip, straight from
// TwinSnapshot (one row per day, written by the twin inference in
// lib/inngest/functions/process-twin-signal.ts). No synthesis — if the user
// is new and has no snapshots yet, this returns an empty array and the UI
// shows an honest "building history" state instead of a fabricated line.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const snapshots = await prisma.twinSnapshot.findMany({
    where: { userId: session.user.id },
    orderBy: { snapshotDate: 'asc' },
    take: 30,
    select: {
      snapshotDate: true,
      cognitiveLoad: true,
      confidenceScore: true,
    },
  })

  const history = snapshots.map((s) => ({
    date: s.snapshotDate.toISOString().split('T')[0],
    cognitiveLoad: Math.round(s.cognitiveLoad),
    confidence: Math.round(s.confidenceScore),
  }))

  return NextResponse.json({ history })
}
