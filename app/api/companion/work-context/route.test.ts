/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { companionWorkContext: {
  findFirst: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(),
} } }))
jest.mock('@/lib/mcp/auth', () => ({ validateMcpBearerToken: jest.fn() }))
jest.mock('@/lib/companion/auth', () => ({ ...jest.requireActual('@/lib/companion/auth'), requireCompanionOAuth: jest.fn() }))
jest.mock('@/lib/companion/devices', () => ({ requireActiveCompanionDevice: jest.fn() }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { requireCompanionOAuth } from '@/lib/companion/auth'
import { requireActiveCompanionDevice } from '@/lib/companion/devices'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import { DELETE, GET, POST } from './route'

const deviceId = 'cd78b30e-93ca-4bd0-893a-a3f709b2f105'
const context = {
  projectLabel: 'Novo Companion', focusSummary: 'Finish the Windows sign-in flow',
  source: 'device', sourceDeviceId: deviceId,
  observedAt: new Date('2026-10-11T10:00:00.000Z'), expiresAt: new Date('2026-10-11T14:00:00.000Z'),
}

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request('https://novo.test/api/companion/work-context', {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
  ;(prisma.companionWorkContext.findFirst as jest.Mock).mockResolvedValue(context)
  ;(prisma.companionWorkContext.upsert as jest.Mock).mockResolvedValue(context)
  ;(prisma.companionWorkContext.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(validateMcpBearerToken as jest.Mock).mockResolvedValue({ ok: true, userId: 'owner-1', authInfo: { scopes: [] } })
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1', scopes: new Set(['device:connect', 'device:work-context:write']) })
  ;(requireActiveCompanionDevice as jest.Mock).mockResolvedValue({ id: deviceId })
})

it('returns only unexpired owner context and never exposes the device binding', async () => {
  const response = await GET(request('GET'))
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(prisma.companionWorkContext.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ userId: 'owner-1', status: 'active', expiresAt: { gt: expect.any(Date) } }),
  }))
  expect(body.context).toEqual(expect.objectContaining({ projectLabel: 'Novo Companion', focusSummary: context.focusSummary }))
  expect(body.context.canClear).toBe(true)
  expect(JSON.stringify(body)).not.toContain('sourceDeviceId')
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('does not offer device-scoped clearing for a note owned by another device', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1', scopes: new Set(['device:connect', 'device:work-context:read']) })
  ;(prisma.companionWorkContext.findFirst as jest.Mock).mockResolvedValue({ ...context, sourceDeviceId: '00000000-0000-4000-8000-000000000002' })

  const response = await GET(request('GET', undefined, { authorization: 'Bearer token', 'X-Novo-Device-Id': deviceId }))
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(body.context.canClear).toBe(false)
  expect(JSON.stringify(body)).not.toContain('sourceDeviceId')
})

it('stores only an explicitly submitted summary with a four-hour expiry', async () => {
  const response = await POST(request('POST', { projectLabel: ' Novo Companion ', focusSummary: '  Finish sign-in   flow ' }))

  expect(response.status).toBe(200)
  const call = (prisma.companionWorkContext.upsert as jest.Mock).mock.calls[0][0]
  expect(call.where).toEqual({ userId: 'owner-1' })
  expect(call.create).toEqual(expect.objectContaining({
    userId: 'owner-1', projectLabel: 'Novo Companion', focusSummary: 'Finish sign-in flow', source: 'web', sourceDeviceId: null,
  }))
  expect(call.create.expiresAt.getTime() - call.create.observedAt.getTime()).toBe(4 * 60 * 60 * 1000)
})

it.each([
  { projectLabel: 'Novo', focusSummary: 'https://private.example/repo' },
  { projectLabel: 'Novo', focusSummary: 'C:\\Users\\Angel\\private-work' },
  { projectLabel: 'Novo', focusSummary: 'API_KEY=secret-value' },
  { projectLabel: 'Novo', focusSummary: 'Focus', windowTitle: 'Private mail subject' },
])('rejects URLs, paths, credential-like text, and unknown captured fields', async (body) => {
  const response = await POST(request('POST', body))
  expect(response.status).toBe(400)
  expect(prisma.companionWorkContext.upsert).not.toHaveBeenCalled()
})

it('requires the dedicated read scope for companion reads', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  ;(requireCompanionOAuth as jest.Mock).mockRejectedValue(new (require('@/lib/companion/auth').CompanionError)(403, 'permission_required'))

  const response = await GET(request('GET', undefined, { authorization: 'Bearer token', 'X-Novo-Device-Id': deviceId }))

  expect(response.status).toBe(403)
  expect(requireCompanionOAuth).toHaveBeenCalledWith(expect.any(Request), ['device:connect', 'device:work-context:read'])
  expect(prisma.companionWorkContext.findFirst).not.toHaveBeenCalled()
})

it('requires an active linked device and the dedicated write scope for companion writes', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  ;(requireCompanionOAuth as jest.Mock).mockResolvedValue({ userId: 'owner-1', scopes: new Set(['device:connect', 'device:work-context:write']) })

  const response = await POST(request('POST', { projectLabel: 'Novo', focusSummary: 'Finish the sign-in flow' }, {
    authorization: 'Bearer token', 'X-Novo-Device-Id': deviceId,
  }))

  expect(response.status).toBe(200)
  expect(requireActiveCompanionDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-1' }), deviceId)
  expect((prisma.companionWorkContext.upsert as jest.Mock).mock.calls[0][0].create).toEqual(expect.objectContaining({
    source: 'device', sourceDeviceId: deviceId,
  }))
})

it('clears only the signed-in account context', async () => {
  const response = await DELETE(request('DELETE'))
  expect(response.status).toBe(200)
  expect(prisma.companionWorkContext.deleteMany).toHaveBeenCalledWith({ where: { userId: 'owner-1' } })
})

it('limits a device clear to context written by that same device', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const response = await DELETE(request('DELETE', undefined, {
    authorization: 'Bearer token', 'X-Novo-Device-Id': deviceId,
  }))
  expect(response.status).toBe(200)
  expect(prisma.companionWorkContext.deleteMany).toHaveBeenCalledWith({ where: { userId: 'owner-1', sourceDeviceId: deviceId } })
})
