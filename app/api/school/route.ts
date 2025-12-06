import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subjectSchema } from '@/lib/schemas/school'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subjects = await prisma.schoolSubject.findMany({
      where: { userId: session.user.id },
      include: { events: true, grades: true },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(subjects)
  } catch (error) {
    console.error('Error fetching school subjects:', error)
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
    const parsedBody = subjectSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, events = [], grades = [] } = parsedBody.data

    const subject = await prisma.schoolSubject.create({
      data: {
        name,
        userId: session.user.id,
        events: {
          create: events.map((event) => ({
            title: event.title,
            date: event.date,
            type: event.type,
            completed: event.completed
          }))
        },
        grades: {
          create: grades.map((grade) => ({
            period: grade.period,
            grade: grade.grade
          }))
        }
      },
      include: { events: true, grades: true }
    })

    return NextResponse.json(subject, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating school subject:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
