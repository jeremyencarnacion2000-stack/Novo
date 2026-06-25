import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { trackerSchema } from '@/lib/schemas/tracker'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where = { userId: session.user.id }

    const [trackers, total] = await Promise.all([
      prisma.tracker.findMany({
        where,
        include: { entries: { take: 30, orderBy: { date: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tracker.count({ where }),
    ])

    const response = NextResponse.json(trackers)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
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
    const parsedBody = trackerSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { name, type, unit, goal, entries = [] } = parsedBody.data

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating tracker:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
