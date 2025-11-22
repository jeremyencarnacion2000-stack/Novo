import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subjects = await prisma.schoolSubject.findMany({
      where: { userId: session.user.id },
      include: { events: true },
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
    const { name, events = [] } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const subject = await prisma.schoolSubject.create({
      data: {
        name,
        userId: session.user.id,
        events: {
          create: events.map((event: any) => ({
            title: event.title,
            date: event.date,
            type: event.type,
            completed: event.completed || false
          }))
        }
      },
      include: { events: true }
    })

    return NextResponse.json(subject, { status: 201 })
  } catch (error) {
    console.error('Error creating school subject:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}