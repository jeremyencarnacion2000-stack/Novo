/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    deal: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    businessClient: { update: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { PUT } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/business/deals/deal-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('business deal update input boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'owner@example.com' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(prisma.deal.findFirst as jest.Mock).mockResolvedValue({ id: 'deal-1', userId: 'user-1', stage: 'lead', clientId: 'client-1' })
    ;(prisma.deal.update as jest.Mock).mockResolvedValue({ id: 'deal-1', stage: 'qualified', value: 100, clientId: 'client-1', client: null })
  })

  it('rejects non-numeric deal values before they reach Prisma', async () => {
    const response = await PUT(request({ value: 'not-a-number' }) as never, { params: Promise.resolve({ id: 'deal-1' }) })

    expect(response.status).toBe(400)
    expect(prisma.deal.update).not.toHaveBeenCalled()
  })

  it('rejects malformed close dates before they reach Prisma', async () => {
    const response = await PUT(request({ expectedClose: 'not-a-date' }) as never, { params: Promise.resolve({ id: 'deal-1' }) })

    expect(response.status).toBe(400)
    expect(prisma.deal.update).not.toHaveBeenCalled()
  })

  it('updates an owned deal with a valid partial payload', async () => {
    const response = await PUT(request({ stage: 'qualified', probability: 65 }) as never, { params: Promise.resolve({ id: 'deal-1' }) })

    expect(response.status).toBe(200)
    expect(prisma.deal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'deal-1' },
      data: { stage: 'qualified', probability: 65 },
    }))
  })
})
