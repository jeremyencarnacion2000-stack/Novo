import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateSubjectSchema } from '@/lib/schemas/school'
import { z } from 'zod'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const parsedBody = updateSubjectSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, events = [], grades = [] } = parsedBody.data

    const subject = await prisma.schoolSubject.update({
      where: { id, userId: session.user.id },
      data: {
        name,
        events: {
          upsert: events.map((event) => ({
            where: { id: event.id || '' },
            update: { title: event.title, date: event.date, type: event.type, completed: event.completed },
            create: { title: event.title, date: event.date, type: event.type, completed: event.completed },
          })),
        },
        grades: {
          upsert: grades.map((grade) => ({
            where: { id: grade.id || '' },
            update: { period: grade.period, grade: grade.grade },
            create: { period: grade.period, grade: grade.grade },
          })),
        },
      },
      include: { events: true, grades: true }
    })

    return NextResponse.json(subject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating school subject:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    await prisma.schoolSubject.delete({
      where: { id, userId: session.user.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting school subject:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}