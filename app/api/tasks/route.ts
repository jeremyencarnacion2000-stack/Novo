import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSameDay, parseISO } from 'date-fns'
import { taskSchema } from '@/lib/schemas/task'
import { z } from 'zod'

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
  } catch (error) {
    console.error('Error fetching tasks:', error)
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
    console.log('Creating task with body:', JSON.stringify(body, null, 2))

    const parsedBody = taskSchema.safeParse(body)

    if (!parsedBody.success) {
      console.error('Task validation failed:', parsedBody.error.format())
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, status, priority, dueDate, projectId, tags } = parsedBody.data

    const task = await prisma.task.create({
      data: {
        title,
        status: status || 'todo',
        priority: priority || 'medium',
        dueDate,
        projectId,
        tags: JSON.stringify(tags || []),
        userId: session.user.id
      }
    })

    // If task has dueDate today, create a linked checklist item
    if (dueDate && isSameDay(parseISO(dueDate), new Date())) {
      try {
        await prisma.checklistItem.create({
          data: {
            text: title,
            completed: false,
            priority: priority || 'medium',
            userId: session.user.id,
            taskId: task.id
          }
        })
      } catch (checklistError) {
        console.error('Failed to create linked checklist item:', checklistError)
      }
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating task:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
