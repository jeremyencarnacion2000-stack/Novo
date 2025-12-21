import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routineSchema } from '@/lib/schemas/routine'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const routines = await prisma.routine.findMany({
      where: { userId: session.user.id },
      include: {
        tasks: true,
        days: {
          include: {
            exercises: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
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
    const parsedBody = routineSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const {
      name,
      description,
      timeOfDay,
      duration,
      tasks = [],
      objective,
      frequency,
      level,
      tempo,
      method,
      isActive,
      days = []
    } = parsedBody.data

    const routine = await prisma.routine.create({
      data: {
        name,
        description,
        timeOfDay,
        duration,
        isActive,
        objective,
        frequency,
        level,
        tempo,
        method,
        userId: session.user.id,
        tasks: {
          create: tasks.map((task: any) => ({
            text: task.text,
            completed: task.completed || false
          }))
        },
        days: {
          create: days.map((day: any, index: number) => ({
            name: day.name,
            weekday: day.weekday,
            order: index,
            exercises: {
              create: day.exercises.map((exercise: any, exIndex: number) => ({
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
                sets: exercise.sets,
                reps: exercise.reps,
                tempo: exercise.tempo,
                notes: exercise.notes,
                order: exIndex
              }))
            }
          }))
        }
      },
      include: {
        tasks: true,
        days: {
          include: {
            exercises: true
          }
        }
      }
    })

    return NextResponse.json(routine, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating routine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
