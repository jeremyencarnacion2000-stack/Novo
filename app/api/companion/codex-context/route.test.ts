/** @jest-environment node */

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return {
    ...actual,
    after: jest.fn((callback: () => void | Promise<void>) => { void callback() }),
  }
})
jest.mock('@/lib/companion/auth', () => ({
  ...jest.requireActual('@/lib/companion/auth'),
  requireCompanionOAuth: jest.fn(),
}))
jest.mock('@/lib/companion/devices', () => ({ requireActiveCompanionDevice: jest.fn() }))
jest.mock('@/lib/cognitive/ambient-twin-runtime', () => ({ runAmbientTwinForUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    novoSignalSourcePreference: { findUnique: jest.fn() },
    novoSignalLedger: { upsert: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { requireCompanionOAuth } from '@/lib/companion/auth'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'
import { after } from 'next/server'
import { POST } from './route'

const deviceId = '29a9fe6a-fae4-4394-af55-638ad1186f78'
const input = {
  sessionKey: 'a'.repeat(64), event: 'prompt', projectLabel: 'novo-web',
  summary: 'Fix the Twin context bridge', observedAt: '2026-10-14T10:00:00.000Z',
}

function request(body: unknown) {
  return new Request('http://localhost/api/companion/codex-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Novo-Device-Id': deviceId },
    body: JSON.stringify(body),
  })
}

describe('POST /api/companion/codex-context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1', scopes: new Set(['device:connect', 'device:work-context:write']) })
    ;(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({ id: deviceId })
    ;(runAmbientTwinForUser as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.novoSignalLedger.upsert as jest.Mock).mockImplementation(async ({ create }: { create: unknown }) => create)
  })

  it('stores only compact summaries under the authorized owner with idempotent fingerprints', async () => {
    const first = await POST(request(input))
    const body = await first.json()
    const firstWrites = (prisma.novoSignalLedger.upsert as jest.Mock).mock.calls.map(([args]) => args)
    const again = await POST(request(input))
    const repeatedWrites = (prisma.novoSignalLedger.upsert as jest.Mock).mock.calls.slice(firstWrites.length).map(([args]) => args)

    expect(first.status).toBe(200)
    expect(body).toMatchObject({ synced: true, source: 'codex' })
    expect(firstWrites).toHaveLength(3)
    expect(firstWrites[0]).toMatchObject({
      where: { userId_fingerprint: { userId: 'owner-1', fingerprint: `codex:${input.sessionKey}:codex_task` } },
      create: { userId: 'owner-1', source: 'codex', sourceRef: input.sessionKey, signalType: 'codex_task' },
    })
    expect(repeatedWrites.map((write: { where: unknown }) => write.where)).toEqual(firstWrites.map((write: { where: unknown }) => write.where))
    expect(JSON.stringify(firstWrites)).not.toContain('raw-session-id')
    expect(again.status).toBe(200)
    expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request), ['device:connect', 'device:work-context:write'])
    expect(requireActiveCompanionDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-1' }), deviceId)
  })

  it('does not store or return summaries when the owner excluded Codex', async () => {
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue({ excludedAt: new Date() })
    const response = await POST(request(input))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ synced: false, excluded: true })
    expect(prisma.novoSignalLedger.upsert).not.toHaveBeenCalled()
    expect(runAmbientTwinForUser).not.toHaveBeenCalled()
  })

  it('refreshes the Twin after a completed task summary arrives', async () => {
    const response = await POST(request({ ...input, event: 'stop', summary: 'Completed the integration safely' }))
    expect(response.status).toBe(200)
    expect(after).toHaveBeenCalledTimes(1)
    expect(runAmbientTwinForUser).toHaveBeenCalledWith('owner-1', { trigger: 'sync' })
  })

  it('rejects unsafe text and session identifiers that are not hashes', async () => {
    const unsafe = await POST(request({ ...input, summary: 'Open C:\\Users\\Angel\\.env and read API_KEY=secret-value' }))
    const unboundedId = await POST(request({ ...input, sessionKey: 'codex-session-id' }))
    expect(unsafe.status).toBe(400)
    expect(unboundedId.status).toBe(400)
    expect(prisma.novoSignalLedger.upsert).not.toHaveBeenCalled()
  })
})
