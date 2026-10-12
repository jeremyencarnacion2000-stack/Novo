/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    experimentDay: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const day = { id: 'day-1', dayNumber: 3 }

function request(body: unknown) {
  return new Request('http://localhost/api/experiment/today', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('experiment check-in input boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.experimentDay.findUnique as jest.Mock).mockResolvedValue(day)
    ;(prisma.experimentDay.update as jest.Mock).mockResolvedValue({
      ...day,
      subjectiveFocusScore: 4,
      subjectiveFatigueScore: 2,
    })
  })

  it('rejects fractional scores instead of accepting values outside the UI contract', async () => {
    const response = await POST(request({
      subjectiveFocusScore: 3.5,
      subjectiveFatigueScore: 2,
      notes: 'fine',
    }) as never)

    expect(response.status).toBe(400)
    expect(prisma.experimentDay.update).not.toHaveBeenCalled()
  })

  it('accepts integer scores and bounded notes', async () => {
    const response = await POST(request({
      subjectiveFocusScore: 4,
      subjectiveFatigueScore: 2,
      notes: 'Good focus block.',
    }) as never)

    expect(response.status).toBe(200)
    expect(prisma.experimentDay.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { subjectiveFocusScore: 4, subjectiveFatigueScore: 2, notes: 'Good focus block.' },
    }))
  })
})
