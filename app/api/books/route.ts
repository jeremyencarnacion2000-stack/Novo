import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  coverUrl: z.string().url().max(2000).optional().nullable(),
  totalPages: z.number().int().min(0).optional().nullable(),
  isbn: z.string().max(20).optional().nullable(),
  status: z.enum(['reading', 'completed', 'to-read', 'dropped']).optional(),
  genre: z.string().max(100).optional().nullable(),
  categories: z.array(z.string().max(50)).max(20).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  format: z.enum(['digital', 'physical', 'audiobook']).optional(),
})

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

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.book.count({ where }),
    ])

    const response = NextResponse.json(books)
    response.headers.set('X-Total-Count', String(total))
    response.headers.set('X-Total-Pages', String(Math.ceil(total / limit)))
    response.headers.set('X-Page', String(page))
    return response
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
    const parsed = createBookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { title, author, coverUrl, totalPages, isbn, status, genre, categories, description, format } = parsed.data

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
        // schema stores categories as a comma-separated String
        categories: Array.isArray(categories) ? categories.join(', ') : categories,
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
