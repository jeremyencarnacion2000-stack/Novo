/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    book: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

function bookRequest(body: unknown) {
  return new Request('http://localhost/api/books', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Book creation idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('returns the existing owned book when the same catalog book is submitted again', async () => {
    const existing = {
      id: 'book-1',
      userId: 'user-1',
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '9781455586691',
      identityKey: 'isbn:9781455586691',
    }
    ;(prisma.book.findFirst as jest.Mock).mockResolvedValue(existing)
    ;(prisma.book.create as jest.Mock).mockResolvedValue({ ...existing, id: 'duplicate-book' })

    const response = await POST(bookRequest({
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '978-1-4555-8669-1',
      externalId: '/works/OL17079854W',
    }) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.json()).toMatchObject({ id: 'book-1' })
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('converges on the database winner when two matching creates race', async () => {
    const winner = {
      id: 'book-winner',
      userId: 'user-1',
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '9781455586691',
      identityKey: 'isbn:9781455586691',
    }
    ;(prisma.book.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner)
    ;(prisma.book.create as jest.Mock).mockRejectedValue({ code: 'P2002' })

    const response = await POST(bookRequest({
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '978-1-4555-8669-1',
    }) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.json()).toMatchObject({ id: 'book-winner' })
    expect(prisma.book.findFirst).toHaveBeenLastCalledWith({
      where: {
        userId: 'user-1',
        identityKey: 'isbn:9781455586691',
      },
    })
  })

  it('normalizes legacy completed status to the canonical read value', async () => {
    ;(prisma.book.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.book.create as jest.Mock).mockResolvedValue({ id: 'book-2', status: 'read' })

    const response = await POST(bookRequest({
      title: 'Deep Work',
      author: 'Cal Newport',
      status: 'completed',
    }) as never)

    expect(response.status).toBe(201)
    expect(prisma.book.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'read' }),
    }))
  })
})
