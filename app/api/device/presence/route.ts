import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// A brief allowance for client/server clock drift — endedAt should never be
// meaningfully in the future, but a few minutes of skew is normal.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

const devicePresenceSchema = z
  .object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  })
  .refine(
    (data) => new Date(data.endedAt).getTime() > new Date(data.startedAt).getTime(),
    { message: 'endedAt must be after startedAt' }
  )
  .refine(
    (data) => new Date(data.endedAt).getTime() <= Date.now() + CLOCK_SKEW_TOLERANCE_MS,
    { message: 'endedAt cannot be in the future' }
  )

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json().catch(() => null)
    const parsed = devicePresenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'InvalidBody' }, { status: 400 })
    }

    await prisma.deviceActivityEvent.create({
      data: {
        userId,
        startedAt: new Date(parsed.data.startedAt),
        endedAt: new Date(parsed.data.endedAt),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Device presence API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
