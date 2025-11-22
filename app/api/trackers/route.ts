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

    const trackers = await prisma.tracker.findMany({
      where: { userId: session.user.id },
      include: { entries: true },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(trackers)
  } catch (error) {
    console.error('Error fetching trackers:', error)
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
    const { name, type, unit, goal, entries = [] } = body

    if (!name || !type || !unit || goal === undefined) {
      return NextResponse.json({ error: 'Name, type, unit, and goal are required' }, { status: 400 })
    }

    const tracker = await prisma.tracker.create({
      data: {
        name,
        type,
        unit,
        goal,
        userId: session.user.id,
        entries: {
          create: entries.map((entry: any) => ({
            date: entry.date,
            value: entry.value
          }))
        }
      },
      include: { entries: true }
    })

    return NextResponse.json(tracker, { status: 201 })
  } catch (error) {
    console.error('Error creating tracker:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}