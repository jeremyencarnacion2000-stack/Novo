import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateActivityHistorySchema = z.object({
  activity: z.string().min(1, 'Activity is required').optional(),
  date: z.string().datetime('Invalid date').optional(),
  duration: z.number().optional().nullable()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const activityEntry = await prisma.activityHistory.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!activityEntry) {
      return NextResponse.json({ error: 'Activity history entry not found' }, { status: 404 })
    }

    return NextResponse.json(activityEntry)
  } catch (error) {
    console.error('Error fetching activity history entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await request.json()
    const parsedBody = updateActivityHistorySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { activity, date, duration } = parsedBody.data

    const updatedActivityEntry = await prisma.activityHistory.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        ...(activity !== undefined && { activity }),
        ...(date !== undefined && { date }),
        ...(duration !== undefined && { duration }),
      }
    })

    return NextResponse.json(updatedActivityEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating activity history entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const activityEntry = await prisma.activityHistory.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (activityEntry.count === 0) {
      return NextResponse.json({ error: 'Activity history entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting activity history entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}