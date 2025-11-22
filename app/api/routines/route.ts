import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const routines = await prisma.routine.findMany({
      where: { userId: session.user.id },
      include: { tasks: true },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(routines)
  } catch (error) {
    console.error('Error fetching routines:', error)
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
    const { name, description, timeOfDay, duration, tasks = [] } = body

    if (!name || !timeOfDay || !duration) {
      return NextResponse.json({ error: 'Name, timeOfDay, and duration are required' }, { status: 400 })
    }

    const routine = await prisma.routine.create({
      data: {
        name,
        description,
        timeOfDay,
        duration,
        userId: session.user.id,
        tasks: {
          create: tasks.map((task: any) => ({
            text: task.text,
            completed: task.completed || false
          }))
        }
      },
      include: { tasks: true }
    })

    return NextResponse.json(routine, { status: 201 })
  } catch (error) {
    console.error('Error creating routine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}