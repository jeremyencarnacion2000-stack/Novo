/** @jest-environment node */
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { aIConversation: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() } } }))
import { PUT } from './route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

const old = { id: 'old', role: 'user', content: 'Hola', timestamp: '2026-10-19T00:00:00Z' }
const newCard = { id: 'companion-review', role: 'assistant', content: 'Revisa este correo', timestamp: '2026-10-19T01:00:00Z', blocks: [{ id: 'card', type: 'confirmation', status: 'waiting', content: { type: 'SEND_EMAIL', payload: { to: 'a@b.test', subject: 'Hola', body: 'Texto' } } }] }
const request = (data: unknown) => new Request('https://novo.test/api/ai-conversations/conv', { method: 'PUT', body: JSON.stringify(data) }) as never
const params = { params: Promise.resolve({ id: 'conv' }) }
beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } })
  ;(prisma.aIConversation.findFirst as jest.Mock).mockResolvedValue({ id: 'conv', userId: 'owner', revision: 4, messages: [old, newCard], createdAt: new Date('2026-10-19T00:00:00Z') })
  ;(prisma.aIConversation.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
})
it('rejects a stale revision before replacing a Companion-created card', async () => {
  const response = await PUT(request({ messages: [old], expectedRevision: 3 }), params)
  expect(response.status).toBe(409)
  expect(prisma.aIConversation.update).not.toHaveBeenCalled()
  expect(prisma.aIConversation.updateMany).not.toHaveBeenCalled()
})
it('preserves server-only messages for an older web client that has no revision', async () => {
  expect((await PUT(request({ messages: [old] }), params)).status).toBe(200)
  expect(prisma.aIConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'conv', userId: 'owner', revision: 4 }, data: expect.objectContaining({ revision: { increment: 1 }, messages: expect.arrayContaining([expect.objectContaining({ id: newCard.id, blocks: newCard.blocks })]) }) }))
})
it('saves a known revision without reading or echoing the stored message history', async () => {
  const response = await PUT(request({ messages: [old, newCard], expectedRevision: 4 }), params)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ id: 'conv', revision: 5 })
  expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith({
    where: { id: 'conv', userId: 'owner' },
    select: { id: true, revision: true, createdAt: true, messages: false },
  })
})
it('still reads and preserves history when only changing a title', async () => {
  const response = await PUT(request({ title: 'Nuevo título', expectedRevision: 4 }), params)
  expect(response.status).toBe(200)
  expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ messages: true }) }))
  expect(prisma.aIConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Nuevo título', messages: expect.arrayContaining([expect.objectContaining({ id: newCard.id })]) }) }))
})
