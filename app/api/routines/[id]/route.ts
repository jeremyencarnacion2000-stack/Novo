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
      }
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

    const { tasks, days, ...routineData } = parsedBody.data

    // Transaction to handle complex nested updates
    const updatedRoutine = await prisma.$transaction(async (tx) => {
      // 1. Update basic fields
      await tx.routine.update({
        where: { id, userId: session.user.id },
        data: { ...routineData }
      })

      // 2. Handle legacy tasks (upsert)
      if (tasks) {
        // Delete tasks not present in the update
        const taskIds = tasks.map(t => t.id).filter(Boolean) as string[]
        await tx.routineTask.deleteMany({
          where: { routineId: id, id: { notIn: taskIds } }
        })

        // Upsert tasks
        for (const task of tasks) {
          if (task.id) {
            await tx.routineTask.update({
              where: { id: task.id },
              data: { text: task.text, completed: task.completed }
            })
          } else {
            await tx.routineTask.create({
              data: {
                routineId: id,
                text: task.text,
                completed: task.completed || false
              }
            })
          }
        }
      }

      // 3. Handle structured days and exercises (full replacement strategy for simplicity in MVP)
      if (days) {
        // Delete all existing days (and cascading exercises)
        await tx.routineDay.deleteMany({
          where: { routineId: id }
        })

        // Recreate all days and exercises
        for (const [index, day] of days.entries()) {
          await tx.routineDay.create({
            data: {
              routineId: id,
              name: day.name,
              order: index,
              exercises: {
                create: day.exercises.map((ex: any, exIndex: number) => ({
                  name: ex.name,
                  muscleGroup: ex.muscleGroup,
                  sets: ex.sets,
                  reps: ex.reps,
                  tempo: ex.tempo,
                  notes: ex.notes,
                  order: exIndex
                }))
              }
            }
          })
        }
      }

      // Return updated routine
      return tx.routine.findUnique({
        where: { id },
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
        }
      })
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