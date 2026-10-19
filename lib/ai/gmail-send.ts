import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { gmailService } from '@/lib/google'
import { emailSendSchema } from '@/lib/gmail-message'
import { createMutationFingerprint, IdempotencyConflictError } from '@/lib/server-idempotency'
import { isGmailReauthorizationError } from './gmail-context'

type Delivery = { status: 'sent'; id: string } | { status: 'failed'; code: string } | { status: 'uncertain' }

/** The caller is the explicit review/confirmation endpoint. A durable claim is
 * committed before Gmail is called; no error path automatically repeats a send. */
export async function sendReviewedEmail(userId: string, input: unknown, idempotencyKey?: string, db: PrismaClient = prisma): Promise<Delivery> {
  const mail = emailSendSchema.parse(input)
  if (!idempotencyKey?.trim() || idempotencyKey.length > 128) throw new Error('email_confirmation_required')
  const scope = 'gmail:send:v1'
  const fingerprint = createHash('sha256').update(createMutationFingerprint(mail)).digest('hex')
  const messageId = `<${createHash('sha256').update(`${userId}:${idempotencyKey}`).digest('hex')}@novo.local>`
  const where = { userId_scope_idempotencyKey: { userId, scope, idempotencyKey } }
  async function existingDelivery(existing: { fingerprint: string; resourceId: string }): Promise<Delivery> {
    if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError('Email approval was already used for another message')
    if (existing.resourceId.startsWith('sent:')) return { status: 'sent', id: existing.resourceId.slice(5) }
    if (existing.resourceId.startsWith('failed:')) return { status: 'failed', code: existing.resourceId.slice(7) }
    // A timeout or a crash may hide a successful provider write. Search for the
    // stable RFC Message-ID; absence is not proof of failure (indexing can lag).
    try {
      const id = await gmailService.findSentForUser(userId, messageId)
      if (id) {
        await db.mutationRequest.update({ where, data: { resourceId: `sent:${id}` } })
        return { status: 'sent', id }
      }
    } catch { /* Authorization/read failure cannot authorize a second send. */ }
    return { status: 'uncertain' }
  }
  const existing = await db.mutationRequest.findUnique({ where })
  if (existing) return existingDelivery(existing)
  try {
    await db.mutationRequest.create({ data: { userId, scope, idempotencyKey, fingerprint, resourceType: 'gmail_delivery', resourceId: 'sending' } })
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error
    const winner = await db.mutationRequest.findUnique({ where })
    if (winner) return existingDelivery(winner)
    throw error
  }
  try {
    const sent = await gmailService.sendEmailForUser(userId, mail, messageId)
    if (!sent.id) throw new Error('missing_delivery_receipt')
    await db.mutationRequest.update({ where, data: { resourceId: `sent:${sent.id}` } })
    return { status: 'sent', id: sent.id }
  } catch (error) {
    const candidate = error as { code?: number; response?: { status?: number }; message?: string }
    const status = Number(candidate?.response?.status ?? candidate?.code)
    const rejected = status >= 400 && status < 500 && status !== 408
    const code = isGmailReauthorizationError(error) ? 'gmail_reauthorization_required'
      : candidate?.message === 'gmail_reply_unavailable' ? 'gmail_reply_unavailable'
        : candidate?.message === 'Google connection with the required permission was not found.' ? 'gmail_permission_required'
          : rejected ? 'gmail_send_rejected' : null
    // Even a failed receipt write after successful delivery remains claimed.
    // Return uncertainty; a later retry only reconciles the stable Message-ID.
    try { await db.mutationRequest.update({ where, data: { resourceId: code ? `failed:${code}` : 'uncertain' } }) } catch { /* Keep the original sending claim. */ }
    return code ? { status: 'failed', code } : { status: 'uncertain' }
  }
}
