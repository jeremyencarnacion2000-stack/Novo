import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional().nullable(),
  status: z.enum(['read', 'reading', 'to-read']),
})

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
    const parsedBody = bookSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.format() }, { status: 400 })
    }

    const { title, author, status } = parsedBody.data

    // Buscar carátula usando Google Books API
    let coverUrl = null
    try {
      const query = `intitle:${title}${author ? ` inauthor:${author}` : ''}`
      const apiResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`)
      if (apiResponse.ok) {
        const data = await apiResponse.json()
        if (data.items && data.items.length > 0) {
          const volumeInfo = data.items[0].volumeInfo
          if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
            coverUrl = volumeInfo.imageLinks.thumbnail
          }
        }
      }
    } catch (error) {
      console.error('Error fetching cover from Google Books API:', error)
      // Continuar sin carátula si falla la API
    }

    const book = await prisma.book.create({
      data: {
        title,
        author,
        status,
        coverUrl,
        userId: session.user.id
      }
    })

    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating book:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}