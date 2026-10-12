import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { decryptCondition } from '@/lib/experiment/crypto'
import { computeRealWindow, computeControlWindow } from '@/lib/experiment/deep-work-window'

function todayDateOnly(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const experimentCheckinSchema = z.object({
  subjectiveFocusScore: z.number().int().min(1).max(5),
  subjectiveFatigueScore: z.number().int().min(1).max(5),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const date = todayDateOnly()
    const day = await prisma.experimentDay.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    })

    if (!day) {
      return NextResponse.json({ active: false })
    }

    // Idempotent: if today's window was already generated, just return it —
    // never re-decrypt or recompute mid-day.
    if (day.displayedWindowStart && day.displayedWindowEnd) {
      return NextResponse.json({
        active: true,
        dayNumber: day.dayNumber,
        windowStart: day.displayedWindowStart,
        windowEnd: day.displayedWindowEnd,
        subjectiveFocusScore: day.subjectiveFocusScore,
        subjectiveFatigueScore: day.subjectiveFatigueScore,
      })
    }

    const condition = decryptCondition(day.encryptedCondition, day.iv, day.authTag)
    const window = condition === 'REAL'
      ? await computeRealWindow(session.user.id, date)
      : await computeControlWindow(session.user.id, date)

    const windowStart = new Date(date)
    windowStart.setHours(window.startHour, 0, 0, 0)
    const windowEnd = new Date(date)
    windowEnd.setHours(window.endHour, 0, 0, 0)

    await prisma.experimentDay.update({
      where: { id: day.id },
      data: { displayedWindowStart: windowStart, displayedWindowEnd: windowEnd, generatedAt: new Date() },
    })

    return NextResponse.json({
      active: true,
      dayNumber: day.dayNumber,
      windowStart,
      windowEnd,
      subjectiveFocusScore: null,
      subjectiveFatigueScore: null,
    })
  } catch (error) {
    console.error('Error resolving today\'s experiment window.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = experimentCheckinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid check-in', details: parsed.error.flatten() }, { status: 400 })
    }
    const { subjectiveFocusScore, subjectiveFatigueScore, notes } = parsed.data

    const date = todayDateOnly()
    const day = await prisma.experimentDay.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    })
    if (!day) {
      return NextResponse.json({ error: 'No active experiment day for today' }, { status: 404 })
    }

    const updated = await prisma.experimentDay.update({
      where: { id: day.id },
      data: { subjectiveFocusScore, subjectiveFatigueScore, notes: notes || null },
    })

    return NextResponse.json({
      dayNumber: updated.dayNumber,
      subjectiveFocusScore: updated.subjectiveFocusScore,
      subjectiveFatigueScore: updated.subjectiveFatigueScore,
    })
  } catch (error) {
    console.error('Error recording experiment check-in.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
