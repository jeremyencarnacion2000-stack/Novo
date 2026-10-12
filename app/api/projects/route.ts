import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { projectSchema } from '@/lib/schemas/project'
import { z } from 'zod'

const PROJECT_CREATE_SCOPE = 'project_create'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function projectResponse(project: unknown, replay: boolean) {
  const response = NextResponse.json(project, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        subtasks: {
          select: { id: true, title: true, completed: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(projects)
  } catch {
    console.error('Error fetching projects.')
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

    const parsedBody = projectSchema.safeParse(body)

    if (!parsedBody.success) {
      console.error('Project validation failed.')
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, description, status, priority, startDate, dueDate, progress, tags, subtasks, notes } = parsedBody.data
    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }

    const fingerprint = JSON.stringify({ title, description, status, priority, startDate, dueDate, progress, tags, subtasks, notes })
    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: PROJECT_CREATE_SCOPE, idempotencyKey } },
      })
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        }
        const existingProject = await prisma.project.findFirst({
          where: { id: existing.resourceId, userId: session.user.id },
          include: { subtasks: true },
        })
        if (existingProject) return projectResponse(existingProject, true)
        return NextResponse.json({ error: 'Idempotent request result is unavailable' }, { status: 409 })
      }
    }

    const createProject = (db: typeof prisma) => db.project.create({
      data: {
        title,
        description,
        status,
        priority,
        startDate,
        dueDate,
        progress,
        tags: JSON.stringify(tags),
        notes,
        userId: session.user.id,
        subtasks: {
          create: subtasks.map((subtask) => ({
            title: subtask.title,
            completed: subtask.completed,
          })),
        },
      },
      include: { subtasks: true },
    })

    if (!idempotencyKey) return projectResponse(await createProject(prisma), false)

    try {
      const project = await prisma.$transaction(async (tx) => {
        await tx.mutationRequest.create({
          data: {
            userId: session.user.id,
            scope: PROJECT_CREATE_SCOPE,
            idempotencyKey,
            fingerprint,
            resourceType: 'project',
            resourceId: 'pending',
          },
        })
        const created = await createProject(tx as typeof prisma)
        await tx.mutationRequest.update({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: PROJECT_CREATE_SCOPE, idempotencyKey } },
          data: { resourceId: created.id },
        })
        return created
      })
      return projectResponse(project, false)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: { userId_scope_idempotencyKey: { userId: session.user.id, scope: PROJECT_CREATE_SCOPE, idempotencyKey } },
        })
        if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
          const winnerProject = await prisma.project.findFirst({
            where: { id: winner.resourceId, userId: session.user.id },
            include: { subtasks: true },
          })
          if (winnerProject) return projectResponse(winnerProject, true)
        }
      }
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error.')
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[projects] Creation failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
