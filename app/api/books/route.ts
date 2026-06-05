import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const books = await prisma.book.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(books)
  } catch (error) {
    console.error('Error fetching books:', error)
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
    const { title, author, coverUrl, totalPages, isbn, status, genre, categories, description, format } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const book = await prisma.book.create({
      data: {
        userId: session.user.id,
        title,
        author,
        coverUrl,
        totalPages,
        isbn,
        status: status || 'to-read',
        currentPage: 0,
        genre,
        categories,
        description,
        format: format || 'digital',
      }
    })

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error creating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
