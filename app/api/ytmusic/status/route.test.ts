/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { GET, POST } from './route'

describe('YouTube Music player status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not expose or mutate shared anonymous player state', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const getResponse = await GET(new NextRequest('http://localhost/api/ytmusic/status'))
    const postResponse = await POST(new NextRequest('http://localhost/api/ytmusic/status', {
      method: 'POST',
      body: JSON.stringify({ currentTrack: null, isPlaying: true, progress: 0 }),
    }))

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
  })

  it('validates state before storing it for the authenticated user', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a' } })

    const invalid = await POST(new NextRequest('http://localhost/api/ytmusic/status', {
      method: 'POST',
      body: JSON.stringify({ currentTrack: null, isPlaying: 'yes', progress: -1 }),
    }))
    expect(invalid.status).toBe(400)

    const valid = await POST(new NextRequest('http://localhost/api/ytmusic/status', {
      method: 'POST',
      body: JSON.stringify({ currentTrack: null, isPlaying: true, progress: 12_000 }),
    }))
    expect(valid.status).toBe(200)
  })
})
