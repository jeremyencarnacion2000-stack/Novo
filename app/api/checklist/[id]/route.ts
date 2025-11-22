import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const item = await prisma.checklistItem.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching checklist item:', error)
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
    const { text, completed, priority, version } = body

    // Check for conflicts
    const currentItem = await prisma.checklistItem.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (version !== undefined && currentItem.version !== version) {
      return NextResponse.json({
        error: 'Conflict detected',
        current: currentItem
      }, { status: 409 })
    }

    const updatedItem = await prisma.checklistItem.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(completed !== undefined && { completed }),
        ...(priority !== undefined && { priority }),
        version: { increment: 1 }
      }
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error updating checklist item:', error)
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

    const item = await prisma.checklistItem.deleteMany({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (item.count === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}