import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const checklistItemSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  completed: z.boolean().optional().default(false),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().optional().nullable(),
  source: z.string().optional().default('manual'),
  sourceId: z.string().optional().nullable()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.checklistItem.findMany({
      where: { userId: session.user.id },
      include: {
        task: {
          include: {
            project: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching checklist items:', error)
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
    const parsedBody = checklistItemSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { text, completed, priority, dueDate, source, sourceId } = parsedBody.data

    const item = await prisma.checklistItem.create({
      data: {
        text,
        completed,
        priority,
        source,
        sourceId: sourceId || undefined,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: session.user.id
      }
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating checklist item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
