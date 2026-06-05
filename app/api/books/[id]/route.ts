import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      currentPage, status, rating, review, notes, pageNotes,
      startedAt, finishedAt, genre, categories, description, format
    } = body

    const book = await prisma.book.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        currentPage,
        status,
        rating,
        review,
        notes,
        pageNotes,
        genre,
        categories,
        description,
        format,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        finishedAt: finishedAt ? new Date(finishedAt) : undefined,
      }
    })

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error updating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.book.delete({
      where: {
        id,
        userId: session.user.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}