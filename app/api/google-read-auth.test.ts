/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/google', () => ({
  peopleService: { listContacts: jest.fn() },
  booksService: { searchBooks: jest.fn() },
}))

import { getServerSession } from 'next-auth'
import { peopleService, booksService } from '@/lib/google'
import { GET as getContacts } from './contacts/route'
import { GET as searchBooks } from './books/search/route'

describe('Google-backed read routes require a complete session identity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: {} })
  })

  it('does not call People when the session has no user id', async () => {
    const response = await getContacts(new Request('http://localhost/api/contacts'))

    expect(response.status).toBe(401)
    expect(peopleService.listContacts).not.toHaveBeenCalled()
  })

  it('does not call Books when the session has no user id', async () => {
    const response = await searchBooks(new Request('http://localhost/api/books/search?q=novo'))

    expect(response.status).toBe(401)
    expect(booksService.searchBooks).not.toHaveBeenCalled()
  })

  it('trims a book search and rejects oversized input before the provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(booksService.searchBooks as jest.Mock).mockResolvedValue([])

    const trimmed = await searchBooks(new Request('http://localhost/api/books/search?q=%20design%20'))
    expect(trimmed.status).toBe(200)
    expect(booksService.searchBooks).toHaveBeenCalledWith('design')

    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const oversized = await searchBooks(new Request(`http://localhost/api/books/search?q=${'x'.repeat(201)}`))
    expect(oversized.status).toBe(400)
    expect(booksService.searchBooks).not.toHaveBeenCalled()
  })
})
