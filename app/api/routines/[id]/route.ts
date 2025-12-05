import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateRoutineSchema } from '@/lib/schemas/routine'
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
    const parsedBody = updateRoutineSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { tasks, ...routineData } = parsedBody.data

    const updatedRoutine = await prisma.routine.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        ...routineData,
        tasks: {
          upsert: tasks?.map((task) => ({
            where: { id: task.id || '' },
            update: { text: task.text, completed: task.completed },
            create: { text: task.text, completed: task.completed },
          })),
        },
      },
      include: { tasks: true }
    })

    return NextResponse.json(updatedRoutine)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
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