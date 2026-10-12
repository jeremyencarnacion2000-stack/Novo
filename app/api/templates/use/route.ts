import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defaultTemplates } from '@/lib/templates'

const TEMPLATE_USE_SCOPE = 'template_use'
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

type TemplateResource = {
  type: 'routine' | 'project' | 'tracker'
  id: string
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function templateResponse(resource: TemplateResource, replay: boolean) {
  const response = NextResponse.json({ success: true, ...resource }, { status: replay ? 200 : 201 })
  response.headers.set('X-Idempotent-Replay', String(replay))
  return response
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const templateId = typeof body?.templateId === 'string' ? body.templateId : ''
    const template = defaultTemplates.find((candidate) => candidate.id === templateId)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const rawIdempotencyKey = request.headers.get('Idempotency-Key')
    const idempotencyKey = rawIdempotencyKey?.trim() || null
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }

    const fingerprint = `template:${template.id}`
    if (idempotencyKey) {
      const existing = await prisma.mutationRequest.findUnique({
        where: {
          userId_scope_idempotencyKey: {
            userId: session.user.id,
            scope: TEMPLATE_USE_SCOPE,
            idempotencyKey,
          },
        },
      })

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return NextResponse.json({ error: 'Idempotency key was already used for another request' }, { status: 409 })
        }
        return templateResponse({ type: existing.resourceType as TemplateResource['type'], id: existing.resourceId }, true)
      }
    }

    const templateContent = template.content as { tasks?: Array<Record<string, unknown>>; name?: string; unit?: string; goal?: number }
    const tasksToCreate = templateContent.tasks || []

    const createResource = async (db: typeof prisma): Promise<TemplateResource> => {
      if (template.type === 'routine') {
        const routine = await db.routine.create({
          data: {
            userId: session.user.id,
            name: template.name,
            description: template.description || '',
            timeOfDay: 'morning',
            duration: tasksToCreate.reduce((acc, task) => acc + (typeof task.duration === 'number' ? task.duration : 0), 0),
            isActive: true,
            tasks: {
              create: tasksToCreate.map((task) => ({
                text: typeof task.text === 'string' ? task.text : '',
                completed: false,
              })),
            },
          },
        })
        return { type: 'routine', id: routine.id }
      }

      if (template.type === 'project') {
        const project = await db.project.create({
          data: {
            userId: session.user.id,
            title: template.name,
            description: template.description || '',
            status: 'not-started',
            priority: 'medium',
            tags: '[]',
            tasks: {
              create: tasksToCreate.map((task) => ({
                title: typeof task.title === 'string' ? task.title : typeof task.text === 'string' ? task.text : '',
                status: typeof task.status === 'string' ? task.status : 'todo',
                priority: 'medium',
                tags: '[]',
                userId: session.user.id,
              })),
            },
          },
        })
        return { type: 'project', id: project.id }
      }

      if (template.type === 'tracker') {
        const tracker = await db.tracker.create({
          data: {
            userId: session.user.id,
            name: templateContent.name || template.name,
            type: 'metric',
            unit: templateContent.unit || '',
            goal: templateContent.goal || 0,
          },
        })
        return { type: 'tracker', id: tracker.id }
      }

      throw new Error('Unsupported template type')
    }

    if (!idempotencyKey) {
      return templateResponse(await createResource(prisma), false)
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        await tx.mutationRequest.create({
          data: {
            userId: session.user.id,
            scope: TEMPLATE_USE_SCOPE,
            idempotencyKey,
            fingerprint,
            resourceType: template.type,
            resourceId: 'pending',
          },
        })

        const resource = await createResource(tx as typeof prisma)
        await tx.mutationRequest.update({
          where: {
            userId_scope_idempotencyKey: {
              userId: session.user.id,
              scope: TEMPLATE_USE_SCOPE,
              idempotencyKey,
            },
          },
          data: { resourceType: resource.type, resourceId: resource.id },
        })
        return resource
      })
      return templateResponse(created, false)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winner = await prisma.mutationRequest.findUnique({
          where: {
            userId_scope_idempotencyKey: {
              userId: session.user.id,
              scope: TEMPLATE_USE_SCOPE,
              idempotencyKey,
            },
          },
        })
        if (winner && winner.fingerprint === fingerprint && winner.resourceId !== 'pending') {
          return templateResponse({ type: winner.resourceType as TemplateResource['type'], id: winner.resourceId }, true)
        }
      }
      throw error
    }
  } catch {
    console.error('[templates] Use failed.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
