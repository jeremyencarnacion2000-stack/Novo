/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/google', () => ({
  peopleService: { listContacts: jest.fn() },
}))

import { getServerSession } from 'next-auth'
import { peopleService } from '@/lib/google'
import { GET } from './route'

describe('Google Contacts route bounds provider page size', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(peopleService.listContacts as jest.Mock).mockResolvedValue([])
  })

  it('clamps an oversized page before calling Google', async () => {
    const response = await GET(new Request('http://localhost/api/contacts?pageSize=999999'))

    expect(response.status).toBe(200)
    expect(peopleService.listContacts).toHaveBeenCalledWith(100)
  })

  it('uses the safe default for an invalid page value', async () => {
    const response = await GET(new Request('http://localhost/api/contacts?pageSize=not-a-number'))

    expect(response.status).toBe(200)
    expect(peopleService.listContacts).toHaveBeenCalledWith(50)
  })
})
