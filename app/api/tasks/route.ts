import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { taskSchema } from '@/lib/schemas/task'
import { z } from 'zod'
import { emitTwinSignal } from '@/lib/twin-signal'
import { syncTaskToCalendars } from '@/lib/task-calendar-sync'
import type { Task } from '@prisma/client'
import { syncTaskChecklist } from '@/lib/task-checklist-sync'

const TASK_CREATE_SCOPE = 'task_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function taskResponse(task: { id: string }, replay: boolean) {
  const response = NextResponse.json(task, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const where: any = {
      userId: session.user.id,
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        project: {
          select: {
            title: true,
            // color: true // Project model might not have color yet, check schema if needed
          }
        }
      }
    })

    return NextResponse.json(tasks)
  } catch {
    console.error('Error fetching tasks.')
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

    const parsedBody = taskSchema.safeParse(body)

    if (!parsedBody.success) {
      console.error('Task validation failed.')
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, status, priority, dueDate, projectId, tags } = parsedBody.data
    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }

    // The key represents a single UI/API intent, not task content. Two tasks
    // with the same title can be intentional, while a retried request must not
    // create a second copy.
    const fingerprint = JSON.stringify({ title, status: status || 'todo', priority: priority || 'medium', dueDate: dueDate || null, projectId: projectId || null, tags: tags || [] })
    let task: Task | null = null
    let replay = false
    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TASK_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        }
        const existingTask = await prisma.task.findFirst({
          where: { id: existing.resourceId, userId: session.user.id },
        })
        // Do not return before repairing side effects. A first attempt may
        // have persisted the task but lost calendar/checklist sync; a replay
        // is the natural opportunity to reconcile those mirrors.
        if (existingTask) {
          task = existingTask
          replay = true
        } else {
          return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
        }
      }
    }

    const createTask = (db: typeof prisma) => db.task.create({
      data: {
        title,
        status: status || 'todo',
        priority: priority || 'medium',
        dueDate,
        projectId,
        tags: JSON.stringify(tags || []),
        userId: session.user.id,
      },
    })

    if (!idempotencyKey) {
      task = await createTask(prisma)
    } else if (!replay) {
      try {
        task = await prisma.$transaction(async (tx) => {
          await tx.mutationRequest.create({
            data: {
              userId: session.user.id,
              scope: TASK_CREATE_SCOPE,
              idempotencyKey,
              fingerprint,
              resourceType: 'task',
              resourceId: 'pending',
            },
          })
          const created = await createTask(tx as typeof prisma)
          await tx.mutationRequest.update({
            where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TASK_CREATE_SCOPE, idempotencyKey } },
            data: { resourceId: created.id },
          })
          return created
        })
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const winner = await prisma.mutationRequest.findUnique({
            where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: TASK_CREATE_SCOPE, idempotencyKey } },
          })
          if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
            const winnerTask = await prisma.task.findFirst({
              where: { id: winner.resourceId, userId: session.user.id },
            })
            if (winnerTask) {
              task = winnerTask
              replay = true
            }
          }
        }
        if (!task) throw error
      }
    }

    if (!task) throw new Error('Task creation did not produce a resource')

    try {
      await syncTaskToCalendars({
        userId: session.user.id,
        taskId: task.id,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
      })
    } catch {
      console.warn('[tasks] Calendar sync skipped.')
    }

    // Reconcile the checklist on both first create and idempotent replay. This
    // also cleans a stale mirror if an earlier provider step was interrupted.
    try {
      await syncTaskChecklist({
        userId: session.user.id,
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
      })
    } catch {
      console.error('[tasks] Linked checklist sync failed.')
    }

    // Emit behavioral signal (fire-and-forget)
    emitTwinSignal({ userId: session.user.id, signal: 'task_created' })

    return taskResponse(task, replay)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[tasks] Creation failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
