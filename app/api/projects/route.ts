import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { projectSchema } from '@/lib/schemas/project'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
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
    console.log('Creating project with body:', JSON.stringify(body, null, 2))

    const parsedBody = projectSchema.safeParse(body)

    if (!parsedBody.success) {
      console.error('Project validation failed:', parsedBody.error.format())
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, description, status, priority, startDate, dueDate, progress, tags, subtasks, notes } = parsedBody.data

    const project = await prisma.project.create({
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
            completed: subtask.completed
          }))
        }
      },
      include: { subtasks: true }
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.issues)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating project:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}