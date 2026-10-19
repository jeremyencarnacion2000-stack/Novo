/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/google', () => ({ gmailService: { sendEmailForUser: jest.fn(), findSentForUser: jest.fn() } }))
import { sendReviewedEmail } from '../gmail-send'
import { gmailService } from '@/lib/google'
import { IdempotencyConflictError } from '@/lib/server-idempotency'

describe('reviewed Gmail delivery', () => {
  const input = { to: 'person@example.test', subject: 'Solicitud', body: 'Hola, esta es la solicitud revisada.' }
  let rows: Map<string, any>, db: any
  beforeEach(() => {
    jest.clearAllMocks()
    rows = new Map()
    const key = (where: any) => { const value = where.userId_scope_idempotencyKey; return `${value.userId}:${value.idempotencyKey}` }
    db = { mutationRequest: {
      findUnique: jest.fn(async ({ where }) => rows.get(key(where)) ?? null),
      create: jest.fn(async ({ data }) => { const id = `${data.userId}:${data.idempotencyKey}`; if (rows.has(id)) throw { code: 'P2002' }; rows.set(id, { ...data }); return data }),
      update: jest.fn(async ({ where, data }) => { Object.assign(rows.get(key(where)), data); return rows.get(key(where)) }),
    } }
    ;(gmailService.sendEmailForUser as jest.Mock).mockResolvedValue({ id: 'sent123' })
    ;(gmailService.findSentForUser as jest.Mock).mockResolvedValue(null)
  })
  it('claims once, stores no message content and replays the same receipt', async () => {
    const first = await sendReviewedEmail('owner', input, 'intent-1', db)
    const second = await sendReviewedEmail('owner', input, 'intent-1', db)
    expect(first.status).toBe('sent')
    expect(second).toEqual(first)
    expect(gmailService.sendEmailForUser).toHaveBeenCalledTimes(1)
    expect(JSON.stringify([...rows.values()])).not.toContain(input.body)
    expect(JSON.stringify([...rows.values()])).not.toContain(input.to)
  })
  it('never resends an uncertain delivery, and reconciles a later Gmail sent receipt', async () => {
    ;(gmailService.sendEmailForUser as jest.Mock).mockRejectedValue(new Error('network lost'))
    expect((await sendReviewedEmail('owner', input, 'intent-2', db)).status).toBe('uncertain')
    expect((await sendReviewedEmail('owner', input, 'intent-2', db)).status).toBe('uncertain')
    ;(gmailService.findSentForUser as jest.Mock).mockResolvedValue('found123')
    expect(await sendReviewedEmail('owner', input, 'intent-2', db)).toEqual({ status: 'sent', id: 'found123' })
    expect(gmailService.sendEmailForUser).toHaveBeenCalledTimes(1)
  })
  it('prevents concurrent sends and rejects changes to an approved intent', async () => {
    await Promise.all([sendReviewedEmail('owner', input, 'intent-3', db), sendReviewedEmail('owner', input, 'intent-3', db)])
    expect(gmailService.sendEmailForUser).toHaveBeenCalledTimes(1)
    await expect(sendReviewedEmail('owner', { ...input, to: 'different@example.test' }, 'intent-3', db)).rejects.toBeInstanceOf(IdempotencyConflictError)
  })
  it('requires a review identity and validates payload before claiming or sending', async () => {
    await expect(sendReviewedEmail('owner', input, undefined, db)).rejects.toThrow('email_confirmation_required')
    await expect(sendReviewedEmail('owner', { ...input, subject: 'Injected\r\nBcc: other@example.test' }, 'intent-4', db)).rejects.toThrow()
    expect(gmailService.sendEmailForUser).not.toHaveBeenCalled()
    expect(db.mutationRequest.create).not.toHaveBeenCalled()
  })
  it('isolates the same client intent key across owners', async () => {
    await sendReviewedEmail('owner-1', input, 'same-key', db)
    await sendReviewedEmail('owner-2', input, 'same-key', db)
    expect(gmailService.sendEmailForUser).toHaveBeenCalledTimes(2)
  })
})
