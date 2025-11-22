import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const routine = await prisma.routine.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: { tasks: true }
    })

    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    return NextResponse.json(routine)
  } catch (error) {
    console.error('Error fetching routine:', error)
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
    const { name, description, timeOfDay, duration, isActive, tasks } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (timeOfDay !== undefined) updateData.timeOfDay = timeOfDay
    if (duration !== undefined) updateData.duration = duration
    if (isActive !== undefined) updateData.isActive = isActive
    updateData.version = { increment: 1 }

    if (tasks) {
      // Delete existing tasks and create new ones
      await prisma.routineTask.deleteMany({
        where: { routineId: id }
      })
      updateData.tasks = {
        create: tasks.map((task: any) => ({
          text: task.text,
          completed: task.completed || false
        }))
      }
    }

    const routine = await prisma.routine.updateMany({
      where: {
        id,
        userId: session.user.id
      },
      data: updateData
    })

    if (routine.count === 0) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    const updatedRoutine = await prisma.routine.findUnique({
      where: { id },
      include: { tasks: true }
    })

    return NextResponse.json(updatedRoutine)
  } catch (error) {
    console.error('Error updating routine:', error)
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

    const routine = await prisma.routine.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (routine.count === 0) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting routine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}