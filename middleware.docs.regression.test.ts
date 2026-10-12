import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { middleware } from './middleware'

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

describe('public documentation boundary', () => {
  it('keeps nested documentation pages public for first-time visitors', async () => {
    ;(getToken as jest.Mock).mockResolvedValue(null)

    const response = await middleware(new NextRequest('https://productivitynovo.vercel.app/docs/integrations'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(getToken).not.toHaveBeenCalled()
  })
})
