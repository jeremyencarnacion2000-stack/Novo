import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createBookIdentityKey } from '@/lib/books/book-identity'
import { normalizeBookStatus } from '@/lib/books/status'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'

const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  coverUrl: z.string().url().max(2000).optional().nullable(),
  totalPages: z.number().int().min(0).optional().nullable(),
  isbn: z.string().max(20).optional().nullable(),
  // Accept legacy values from older clients, but normalize before persisting.
  status: z.enum(['reading', 'read', 'completed', 'to-read', 'want-to-read', 'dropped']).optional(),
  genre: z.string().max(100).optional().nullable(),
  categories: z.array(z.string().max(50)).max(20).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  format: z.enum(['digital', 'physical', 'audiobook']).optional(),
  externalId: z.string().min(1).max(300).optional().nullable(),
})

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

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
  } catch {
    console.error('Error fetching books.')
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

    const { title, author, coverUrl, totalPages, isbn, status, genre, categories, description, format, externalId } = parsed.data
    const identityKey = createBookIdentityKey({ title, author, isbn, externalId })

    // Catch legacy rows that predate identityKey as well as normal retries.
    // The short lock also covers a catalog retry whose payload changes between
    // attempts (for example, ISBN present on one request but absent on the
    // other). Without it, both requests could pass this lookup concurrently
    // and create two identities for the same owned title.
    const lockIdentity = createBookIdentityKey({ title, author })
    const result = await withProviderSyncLock(
      prisma,
      `novo:book-create:${session.user.id}:${lockIdentity}`,
      async (db) => {
        // Ownership is part of every branch so one user's library can never
        // affect another user's idempotency result.
        const existing = await db.book.findFirst({
          where: {
            userId: session.user.id,
            OR: [
              { identityKey },
              {
                title: { equals: title.trim(), mode: 'insensitive' },
                ...(author
                  ? { author: { equals: author.trim(), mode: 'insensitive' as const } }
                  : { author: null }),
              },
            ],
          },
        })

        if (existing) return { book: existing, replay: true }

        try {
          const book = await db.book.create({
            data: {
              userId: session.user.id,
              identityKey,
              title: title.trim(),
              author: author?.trim(),
              coverUrl,
              totalPages,
              isbn,
              status: normalizeBookStatus(status),
              currentPage: 0,
              genre,
              // schema stores categories as a comma-separated String
              categories: Array.isArray(categories) ? categories.join(', ') : categories,
              description,
              format: format || 'digital',
            },
          })
          return { book, replay: false }
        } catch (error) {
          // Keep the unique index as the final authority for legacy races or
          // requests that arrive before the advisory lock is available.
          if (isUniqueConstraintError(error)) {
            const concurrentWinner = await db.book.findFirst({
              where: { userId: session.user.id, identityKey },
            })
            if (concurrentWinner) return { book: concurrentWinner, replay: true }
          }
          throw error
        }
      },
    )

    const response = NextResponse.json(result.book, { status: result.replay ? 200 : 201 })
    response.headers.set('X-Idempotent-Replay', String(result.replay))
    return response
  } catch {
    console.error('Error creating book.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
