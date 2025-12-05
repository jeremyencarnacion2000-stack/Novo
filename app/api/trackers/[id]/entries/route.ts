import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { trackerEntrySchema } from '@/lib/schemas/tracker'
import { z } from 'zod'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = trackerEntrySchema.safeParse(body)

    if (!parsedBody.success) {
        return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { date, value } = parsedBody.data

    // Verify tracker belongs to user
    const tracker = await prisma.tracker.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
    }

    // Check if entry already exists for this date
    const existingEntry = await prisma.trackerEntry.findFirst({
      where: {
        trackerId: params.id,
        date: date
      }
    })

    let entry
    if (existingEntry) {
      // Update existing entry
      entry = await prisma.trackerEntry.update({
        where: { id: existingEntry.id },
        data: { value }
      })
    } else {
      // Create new entry
      entry = await prisma.trackerEntry.create({
        data: {
          trackerId: params.id,
          date,
          value
        }
      })
    }

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating/updating tracker entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'Valid date parameter is required' }, { status: 400 })
    }

    // Verify tracker belongs to user
    const tracker = await prisma.tracker.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!tracker) {
      return NextResponse.json({ error: 'Tracker not found' }, { status: 404 })
    }

    await prisma.trackerEntry.deleteMany({
      where: {
        trackerId: params.id,
        date: date
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tracker entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}