import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateGratitudeSchema } from '@/lib/schemas/gratitude'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const gratitude = await prisma.gratitude.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!gratitude) {
      return NextResponse.json({ error: 'Gratitude not found' }, { status: 404 })
    }

    return NextResponse.json(gratitude)
  } catch (error) {
    console.error('Error fetching gratitude:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await request.json()
    const parsedBody = updateGratitudeSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { content, date } = parsedBody.data

    const updatedGratitude = await prisma.gratitude.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        ...(content !== undefined && { content }),
        ...(date !== undefined && { date }),
      }
    })

    return NextResponse.json(updatedGratitude)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating gratitude:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const gratitude = await prisma.gratitude.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (gratitude.count === 0) {
      return NextResponse.json({ error: 'Gratitude not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting gratitude:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}