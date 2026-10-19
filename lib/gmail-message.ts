import { z } from 'zod'

const address = z.string().trim().email().max(254).refine(value => !/[\r\n\x00-\x1f\x7f]/.test(value))
export const gmailIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/)
export const emailSendSchema = z.object({
  to: address,
  cc: z.array(address).max(10).optional(),
  bcc: z.array(address).max(10).optional(),
  subject: z.string().trim().min(1).max(500).refine(value => !/[\r\n\x00-\x1f\x7f]/.test(value)),
  body: z.string().trim().min(1).max(100_000),
  replyToMessageId: gmailIdSchema.optional(),
}).strict()
export type EmailSendInput = z.infer<typeof emailSendSchema>
export const emailProposalSchema = z.object({ type: z.literal('SEND_EMAIL'), payload: emailSendSchema }).strict()
export type EmailProposal = z.infer<typeof emailProposalSchema>

export type GmailPart = {
  mimeType?: string | null; filename?: string | null
  headers?: Array<{ name?: string | null; value?: string | null }> | null
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null
  parts?: GmailPart[] | null
}
export type GmailMessageInput = {
  id?: string | null; threadId?: string | null; internalDate?: string | null
  snippet?: string | null; labelIds?: string[] | null; payload?: GmailPart | null
}

function htmlText(html: string) {
  return html.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value: string) => {
      const common: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
      if (common[value.toLowerCase()]) return common[value.toLowerCase()]
      const point = value[1]?.toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
    }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function decodeGmailMessage(message: GmailMessageInput, bodyLimit = 96_000) {
  const headers = message.payload?.headers ?? []
  const header = (name: string) => headers.find(item => item.name?.toLowerCase() === name)?.value ?? ''
  const plain: string[] = [], html: string[] = []
  const attachments: Array<{ id: string; name: string; mimeType: string; size: number }> = []
  let missingBody = false
  function visit(part: GmailPart) {
    if (part.filename) {
      attachments.push({ id: part.body?.attachmentId ?? '', name: part.filename, mimeType: part.mimeType ?? '', size: part.body?.size ?? 0 })
      return
    }
    const mime = part.mimeType?.toLowerCase()
    if (mime === 'text/plain' || mime === 'text/html') {
      if (part.body?.attachmentId && !part.body.data) missingBody = true
      if (part.body?.data) {
        const bytes = Buffer.from(part.body.data, 'base64url')
        const contentType = part.headers?.find(item => item.name?.toLowerCase() === 'content-type')?.value ?? ''
        const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] ?? 'utf-8'
        let decoded: string
        try { decoded = new TextDecoder(charset).decode(bytes) } catch { decoded = bytes.toString('utf8') }
        ;(mime === 'text/plain' ? plain : html).push(decoded)
      }
    }
    for (const child of part.parts ?? []) visit(child)
  }
  if (message.payload) visit(message.payload)
  const body = plain.join('\n\n').trim() || html.map(htmlText).join('\n\n').trim()
  return {
    id: message.id ?? '', threadId: message.threadId ?? '', subject: header('subject') || '(Sin asunto)',
    from: header('from'), to: header('to'), replyTo: header('reply-to'), date: header('date'),
    messageId: header('message-id'), references: header('references'),
    body: body.slice(0, bodyLimit), bodyTruncated: missingBody || body.length > bodyLimit,
    attachments, url: message.id ? `https://mail.google.com/mail/u/0/#all/${message.id}` : undefined,
  }
}

export function composeGmailRaw(input: EmailSendInput, headers: { messageId?: string; inReplyTo?: string; references?: string } = {}) {
  const mail = emailSendSchema.parse(input)
  const parts = [`To: ${mail.to}`]
  if (mail.cc?.length) parts.push(`Cc: ${mail.cc.join(', ')}`)
  if (mail.bcc?.length) parts.push(`Bcc: ${mail.bcc.join(', ')}`)
  parts.push(`Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString('base64')}?=`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64')
  for (const [name, value] of [['Message-ID', headers.messageId], ['In-Reply-To', headers.inReplyTo], ['References', headers.references]]) {
    // Provider headers are untrusted too; never allow an additional RFC header.
    if (value && !/[\r\n\x00-\x1f\x7f]/.test(value) && value.length <= 2000) parts.push(`${name}: ${value}`)
  }
  parts.push('', Buffer.from(mail.body).toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '')
  return Buffer.from(parts.join('\r\n')).toString('base64url')
}
