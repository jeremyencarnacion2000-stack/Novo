/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRaw: jest.fn(),
    novoSignalSourcePreference: { findUnique: jest.fn() },
    novoSignalLedger: { findMany: jest.fn() },
    companionActivityDailySummary: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/mcp/auth', () => ({ validateMcpBearerToken: jest.fn() }))
jest.mock('@/lib/companion/auth', () => ({...jest.requireActual('@/lib/companion/auth'), requireCompanionOAuth:jest.fn()}))
jest.mock('@/lib/companion/devices', () => ({requireActiveCompanionDevice:jest.fn()}))
jest.mock('@/lib/cognitive/signal-ledger', () => ({ upsertNovoSignals: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { GET, POST } from './route'
import {requireCompanionOAuth, CompanionError} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'

const deviceId = '00000000-0000-4000-8000-000000000001'

function activityRequest(payload: unknown, token = 'novo_mcp_secret_value') {
  return new Request('http://localhost/api/companion/activity', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function validPayload() {
  return {
    deviceId,
    summaries: [{ day: new Date().toISOString().slice(0, 10), applicationId: 'Code.EXE', state: 'active', durationSeconds: 60 }],
  }
}

describe('POST /api/companion/activity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['device:activity:write'] },
    })
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
    ;(prisma.companionActivityDailySummary.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([])
  })

  it('new OAuth activity cannot write when the linked device has been revoked', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true, kind:'oauth', userId:'owner-1', authInfo:{scopes:['device:connect', 'device:activity:write']}})
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner-1'})
    ;(requireActiveCompanionDevice as jest.Mock).mockRejectedValue(new CompanionError(403, 'device_revoked'))
    const request = activityRequest(validPayload())
    request.headers.set('X-Novo-Device-Id', deviceId)
    const response = await POST(request as never)
    expect(response.status).toBe(403)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
    expect(prisma.novoSignalSourcePreference.findUnique).not.toHaveBeenCalled()
  })

  it('does not accept an activity body for a different device than the bound header', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ok:true,kind:'oauth',userId:'owner-1',authInfo:{scopes:['device:connect','device:activity:write']}})
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({userId:'owner-1'})
    const request = activityRequest(validPayload())
    request.headers.set('X-Novo-Device-Id','00000000-0000-4000-8000-000000000002')
    const result = await POST(request as never)
    expect(result.status).toBe(400)
    expect(await result.json()).toEqual({error:'device_id_mismatch'})
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('returns only the signed-in owner activity context and honors source exclusion', async () => {
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([{
      sourceRef: 'daily:2026-10-08', signalType: 'device_activity_daily', label: 'Device observed: 2.0h across 3 apps',
      observedAt: new Date('2026-10-08T12:00:00.000Z'), reliability: 'deterministic', correction: null,
    }])

    const response = await GET(new Request('http://localhost/api/companion/activity') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.novoSignalLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-1', source: 'device', observedAt: expect.any(Object), excludedAt: null } }))
    expect(body.signals).toEqual([expect.objectContaining({ sourceRef: 'daily:2026-10-08', label: 'Device observed: 2.0h across 3 apps', reliability: 'deterministic' })])
  })

  it('does not return activity after the owner excludes the device source', async () => {
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue({ excludedAt: new Date() })

    const response = await GET(new Request('http://localhost/api/companion/activity') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ sourceExcluded: true, signals: [] })
    expect(prisma.novoSignalLedger.findMany).not.toHaveBeenCalled()
  })

  it('allows the dedicated activity-read scope without requiring Twin or personal-context access', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['device:connect', 'device:activity:read'] },
    })
    ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1' })
    ;(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({ id: deviceId })
    ;(prisma.novoSignalSourcePreference.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.novoSignalLedger.findMany as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost/api/companion/activity', {
      headers: { authorization: 'Bearer novo-device-token', 'X-Novo-Device-Id': deviceId },
    })
    const response = await GET(request as never)

    expect(response.status).toBe(200)
    expect(requireCompanionOAuth).toHaveBeenCalledWith(request, ['device:connect', 'device:activity:read'])
    expect(requireActiveCompanionDevice).toHaveBeenCalled()
    expect(prisma.novoSignalLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'owner-1', source: 'device' }),
    }))
  })

  it('does not let activity-write alone read the activity ledger', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['device:connect', 'device:activity:write'] },
    })

    const response = await GET(new Request('http://localhost/api/companion/activity', {
      headers: { authorization: 'Bearer novo-device-token', 'X-Novo-Device-Id': deviceId },
    }) as never)

    expect(response.status).toBe(401)
    expect(prisma.novoSignalLedger.findMany).not.toHaveBeenCalled()
  })

  it('requires the dedicated capture scope before accepting any activity', async () => {
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { scopes: ['tasks:read'] },
    })

    const response = await POST(activityRequest(validPayload()) as never)

    expect(response.status).toBe(403)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('rejects titles, paths, and caller-supplied ownership rather than storing them', async () => {
    const response = await POST(activityRequest({
      ...validPayload(),
      userId: 'victim-2',
      summaries: [{ ...validPayload().summaries[0], windowTitle: 'Private email — subject line' }],
    }) as never)

    expect(response.status).toBe(400)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('stores only app/day duration summaries and replaces a daily snapshot idempotently', async () => {
    const response = await POST(activityRequest(validPayload()) as never)
    const body = await response.json()
    const statement = (prisma.$executeRaw as jest.Mock).mock.calls[0][0] as { sql?: string; text?: string; values?: unknown[] }

    expect(response.status).toBe(200)
    expect(body.accepted).toBe(1)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(statement.sql ?? statement.text).toContain('GREATEST')
    expect(statement.values).toEqual(expect.arrayContaining(['owner-1', deviceId, 'code', 'active', 60]))
    expect(prisma.companionActivityDailySummary.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'owner-1', day: { in: [expect.any(Date)] } }), take: 5000,
    }))
    expect(JSON.stringify(statement)).not.toMatch(/eventId|startedAt|endedAt|title|path|url|secret/i)
  })

  it('accepts a token with activity-write scope without requiring twin-read', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const response = await POST(activityRequest(validPayload()) as never)

    expect(response.status).toBe(200)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('accepts an OAuth account token with only the dedicated activity scope', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      authInfo: { clientId: 'novo-companion', scopes: ['device:activity:write'] },
    })

    const request = activityRequest(validPayload(), 'oauth-access-token')
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(validateMcpBearerToken).toHaveBeenCalledWith(request)
  })
})
