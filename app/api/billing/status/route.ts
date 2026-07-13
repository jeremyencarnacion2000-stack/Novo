import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FREE_PLAN_MONTHLY_ACTION_LIMIT } from '@/lib/ai/executor'

// Plan + usage snapshot for the Settings billing tab.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
  ])

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const actionsUsed = await prisma.aiActionLog.count({
    where: { userId: session.user.id, createdAt: { gte: startOfMonth } },
  })

  return NextResponse.json({
    plan: user?.plan ?? 'free',
    actionsUsed,
    actionsLimit: FREE_PLAN_MONTHLY_ACTION_LIMIT,
    interval: subscription?.interval ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  })
}
