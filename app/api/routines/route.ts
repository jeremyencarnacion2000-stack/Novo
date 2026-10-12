import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routineSchema } from '@/lib/schemas/routine'
import { z } from 'zod'

const ROUTINE_CREATE_SCOPE = 'routine_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function routineResponse(routine: unknown, replay: boolean) {
  const response = NextResponse.json(routine, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
}

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
    console.error('Error fetching routines.')
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
      scheduledTime,
      daysOfWeek,
      tasks = [],
      objective,
      frequency,
      level,
      tempo,
      method,
      isActive,
      days = []
    } = parsedBody.data

    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }
    const fingerprint = JSON.stringify({ name, description, timeOfDay, duration, scheduledTime: scheduledTime ?? null, daysOfWeek: daysOfWeek ?? null, tasks, objective, frequency, level, tempo, method, isActive, days })
    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: ROUTINE_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        const existingRoutine = await prisma.routine.findFirst({
          where: { id: existing.resourceId, userId: session.user.id },
          include: { tasks: true, days: { include: { exercises: true } } },
        })
        if (existingRoutine) return routineResponse(existingRoutine, true)
        return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
      }
    }

    const createRoutine = (db: typeof prisma) => db.routine.create({
      data: {
        name,
        description,
        timeOfDay,
        duration,
        scheduledTime: scheduledTime ?? null,
        daysOfWeek: daysOfWeek ?? null,
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

    if (!idempotencyKey) return routineResponse(await createRoutine(prisma), false)

    try {
      const routine = await prisma.$transaction(async (tx) => {
        await tx.mutationRequest.create({
          data: { userId: session.user.id, scope: ROUTINE_CREATE_SCOPE, idempotencyKey, fingerprint, resourceType: 'routine', resourceId: 'pending' },
        })
        const created = await createRoutine(tx as typeof prisma)
        await tx.mutationRequest.update({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: ROUTINE_CREATE_SCOPE, idempotencyKey } },
          data: { resourceId: created.id },
        })
        return created
      })
      return routineResponse(routine, false)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: ROUTINE_CREATE_SCOPE, idempotencyKey } },
        })
        if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
          const winnerRoutine = await prisma.routine.findFirst({
            where: { id: winner.resourceId, userId: session.user.id },
            include: { tasks: true, days: { include: { exercises: true } } },
          })
          if (winnerRoutine) return routineResponse(winnerRoutine, true)
        }
      }
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating routine.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
