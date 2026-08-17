import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stateCheckinSchema } from '@/lib/schemas/cognitive-loop'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = stateCheckinSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid check-in', details: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const completeness = [data.energy, data.focus, data.availableMinutes, data.workload, data.currentContext].filter(Boolean).length / 5
  const snapshot = await prisma.cognitiveStateSnapshot.create({
    data: {
      userId: session.user.id,
      energy: data.energy,
      focus: data.focus,
      availableMinutes: data.availableMinutes,
      workload: data.workload,
      currentContext: data.currentContext,
      completeness,
    },
  })
  await trackNovoLoopEvent(session.user.id, 'state_checkin_completed', { completeness, source: 'checkin' })
  return NextResponse.json({ snapshot })
}
