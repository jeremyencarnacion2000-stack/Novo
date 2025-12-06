import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gratitudeSchema } from '@/lib/schemas/gratitude'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gratitudes = await prisma.gratitude.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(gratitudes)
  } catch (error) {
    console.error('Error fetching gratitudes:', error)
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
    const parsedBody = gratitudeSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { content, date } = parsedBody.data

    const gratitude = await prisma.gratitude.create({
      data: {
        content,
        date: date || new Date().toISOString(),
        userId: session.user.id
      }
    })

    return NextResponse.json(gratitude, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating gratitude:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
