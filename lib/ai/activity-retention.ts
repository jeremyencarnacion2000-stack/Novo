import { prisma } from '@/lib/prisma'

export async function retainAiActivity() {
  const now = new Date()
  const detailedEventCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000)
  const runCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000)
  const expired = await prisma.aiActivityRun.updateMany({
    where: { status: { in: ['running', 'awaiting_confirmation'] }, expiresAt: { lt: now } },
    data: { status: 'expired', phase: 'failed', completedAt: now, errorCode: 'run_expired', errorMessage: 'La ejecución expiró antes de completarse.' },
  })
  const detailedEvents = await prisma.aiActivityEvent.deleteMany({
    where: { timestamp: { lt: detailedEventCutoff }, run: { status: { in: ['completed', 'failed', 'cancelled', 'expired'] } } },
  })
  // Keep compact terminal run summaries for 90 days; external executions are
  // deliberately separate and are never deleted by activity retention.
  const runs = await prisma.aiActivityRun.deleteMany({ where: { updatedAt: { lt: runCutoff }, status: { in: ['completed', 'failed', 'cancelled', 'expired'] } } })
  return { expired: expired.count, detailedEventsDeleted: detailedEvents.count, summariesDeleted: runs.count }
}
