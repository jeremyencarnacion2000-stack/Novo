/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: { findFirst: jest.fn() },
    checklistItem: { findMany: jest.fn() },
    routine: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
    tracker: { findMany: jest.fn() },
    activityHistory: { create: jest.fn() },
  },
}))
jest.mock('@/lib/google', () => ({
  driveService: { exportWorkspaceBackup: jest.fn() },
}))
jest.mock('@/lib/google-account', () => ({
  findGoogleAccountForScopes: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { driveService } from '@/lib/google'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { POST } from './route'

function request() {
  return new Request('http://localhost/api/integration/drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings: {} }),
  })
}

describe('Google Drive backup route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'google-drive-grant', scope: 'openid drive.file' })
    ;(prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.routine.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.task.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.tracker.findMany as jest.Mock).mockResolvedValue([])
  })

  it('returns a safe retryable error without leaking provider details', async () => {
    ;(driveService.exportWorkspaceBackup as jest.Mock).mockRejectedValue(
      new Error('Google access token expired: secret-provider-diagnostic'),
    )

    const response = await POST(request() as never)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'Google Drive backup failed', code: 'DRIVE_EXPORT_FAILED' })
    expect(JSON.stringify(body)).not.toContain('secret-provider-diagnostic')
  })
})
