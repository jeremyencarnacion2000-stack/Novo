import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Owner-scoped status for the latest real Twin inference ActivityRun. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const run = await prisma.aiActivityRun.findFirst({
    where: {
      userId: session.user.id,
      surface: 'twin_inference',
      updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, phase: true, sequence: true, status: true, updatedAt: true },
  })
  return NextResponse.json({ run })
}
