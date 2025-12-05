import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const activityHistorySchema = z.object({
  activity: z.string().min(1, 'Activity is required'),
  date: z.string().datetime('Invalid date'),
  duration: z.number().optional().nullable()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activityHistory = await prisma.activityHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(activityHistory)
  } catch (error) {
    console.error('Error fetching activity history:', error)
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
    const parsedBody = activityHistorySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { activity, date, duration } = parsedBody.data

    const activityEntry = await prisma.activityHistory.create({
      data: {
        activity,
        date,
        duration,
        userId: session.user.id
      }
    })

    return NextResponse.json(activityEntry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating activity history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}