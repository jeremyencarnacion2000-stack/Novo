import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateGoalSchema } from '@/lib/schemas/goal'
import { z } from 'zod'

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

    const goal = await prisma.goal.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json(goal)
  } catch (error) {
    console.error('Error fetching goal:', error)
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
    const parsedBody = updateGoalSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, description, status, deadline } = parsedBody.data

    const updatedGoal = await prisma.goal.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(deadline !== undefined && { deadline }),
      }
    })

    if (status === 'completed') {
      const { trackServerCompletion } = await import('@/lib/analytics-server')
      await trackServerCompletion(session.user.id, 'task', 'goals', {
        goalId: id,
        title: updatedGoal.title
      })
    }

    return NextResponse.json(updatedGoal)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating goal:', error)
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

    const goal = await prisma.goal.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (goal.count === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}