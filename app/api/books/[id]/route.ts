import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { normalizeBookStatus } from '@/lib/books/status'

const dateValue = z.coerce.date().nullable().optional()
const bookPatchSchema = z.object({
  currentPage: z.number().int().min(0).optional(),
  status: z.enum(['reading', 'read', 'completed', 'to-read', 'want-to-read', 'dropped']).optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  review: z.string().max(10000).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  pageNotes: z.array(z.object({
    page: z.number().int().min(0),
    note: z.string().max(5000),
    date: z.coerce.date().optional(),
  }).passthrough()).max(200).nullable().optional(),
  startedAt: dateValue,
  finishedAt: dateValue,
  genre: z.string().max(100).nullable().optional(),
  categories: z.union([
    z.string().max(2000),
    z.array(z.string().max(50)).max(20),
  ]).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  format: z.enum(['digital', 'physical', 'audiobook']).optional(),
}).strict()

function isNotFoundError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'
}

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
    const parsed = bookPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const {
      currentPage, status, rating, review, notes, pageNotes,
      startedAt, finishedAt, genre, categories, description, format
    } = parsed.data
    const serializedPageNotes = pageNotes === null
      ? Prisma.JsonNull
      : pageNotes?.map((note) => ({
        ...note,
        ...(note.date ? { date: note.date.toISOString() } : {}),
      }))

    const book = await prisma.book.update({
      where: {
        id,
        userId: session.user.id
      },
      data: {
        currentPage,
        ...(status !== undefined ? { status: normalizeBookStatus(status) } : {}),
        rating,
        review,
        notes,
        ...(pageNotes !== undefined ? { pageNotes: serializedPageNotes } : {}),
        genre,
        categories: Array.isArray(categories) ? categories.join(', ') : categories,
        description,
        format,
        startedAt,
        finishedAt,
      }
    })

    return NextResponse.json(book)
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
    console.error('Error updating book.')
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
    console.error('Error deleting book.')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
