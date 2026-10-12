/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    book: {
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from './route'

function bookRequest(body: unknown) {
  return new Request('http://localhost/api/books/book-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Book update validation and ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.book.update as jest.Mock).mockResolvedValue({ id: 'book-1', status: 'read' })
  })

  it('normalizes legacy completion values and keeps the owner in the update filter', async () => {
    const response = await PATCH(bookRequest({ status: 'completed', rating: 5 }) as never, {
      params: Promise.resolve({ id: 'book-1' }),
    })

    expect(response.status).toBe(200)
    expect(prisma.book.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'book-1', userId: 'user-1' },
      data: expect.objectContaining({ status: 'read', rating: 5 }),
    }))
  })

  it('rejects unknown fields instead of forwarding arbitrary database writes', async () => {
    const response = await PATCH(bookRequest({ status: 'read', userId: 'another-user' }) as never, {
      params: Promise.resolve({ id: 'book-1' }),
    })

    expect(response.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })
})
