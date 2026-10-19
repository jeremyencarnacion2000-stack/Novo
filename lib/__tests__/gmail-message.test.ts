/** @jest-environment node */
import { decodeGmailMessage, emailSendSchema, composeGmailRaw } from '../gmail-message'

const encoded = (text: string) => Buffer.from(text).toString('base64url')

describe('Gmail message bodies and safe MIME', () => {
  it('reads nested MIME text in full, preserving Unicode and reply identifiers', () => {
    const result = decodeGmailMessage({ id: 'a1', threadId: 'b2', payload: {
      headers: [{ name: 'subject', value: 'Beca' }, { name: 'Message-ID', value: '<original@school.test>' }],
      parts: [{ mimeType: 'multipart/alternative', parts: [
        { mimeType: 'text/html', body: { data: encoded('<p>Alternativa HTML</p>') } },
        { mimeType: 'text/plain', body: { data: encoded('Hola Ángel,\nTu solicitud fue aprobada.\nAtentamente, Admisiones') } },
      ] }, { filename: 'privado.txt', mimeType: 'text/plain', body: { data: encoded('attachment secret'), attachmentId: 'att' } }],
    } })
    expect(result.body).toBe('Hola Ángel,\nTu solicitud fue aprobada.\nAtentamente, Admisiones')
    expect(result.bodyTruncated).toBe(false)
    expect(result.messageId).toBe('<original@school.test>')
    expect(result.attachments).toEqual([expect.objectContaining({ name: 'privado.txt', id: 'att' })])
    expect(result.body).not.toContain('attachment secret')
  })

  it('extracts readable HTML without scripts, tracking pixels or fetching remote content', () => {
    const result = decodeGmailMessage({ payload: { mimeType: 'text/html', body: { data: encoded('<style>secret</style><script>steal()</script><p>Hola &amp; gracias</p><p>Segunda línea<br>Saludos</p><img src="https://tracker.test">') } } })
    expect(result.body).toContain('Hola & gracias')
    expect(result.body).toContain('Segunda línea\nSaludos')
    expect(result.body).not.toMatch(/secret|steal|tracker/)
  })

  it('marks oversized messages honestly rather than silently claiming a complete read', () => {
    const result = decodeGmailMessage({ payload: { mimeType: 'text/plain', body: { data: encoded('x'.repeat(120)) } } }, 100)
    expect(result.body).toHaveLength(100)
    expect(result.bodyTruncated).toBe(true)
  })

  it('rejects header injection and missing recipients before any provider request', () => {
    expect(emailSendSchema.safeParse({ to: 'user@example.test\r\nBcc: stolen@example.test', subject: 'Hola', body: 'Texto' }).success).toBe(false)
    expect(emailSendSchema.safeParse({ to: 'user@example.test', subject: 'Hola\nCc: stolen@example.test', body: 'Texto' }).success).toBe(false)
    expect(emailSendSchema.safeParse({ to: 'un contacto', subject: 'Hola', body: 'Texto' }).success).toBe(false)
  })

  it('sends plain text MIME with Unicode, CC and threaded reply headers', () => {
    const raw = composeGmailRaw({ to: 'recipient@example.test', cc: ['copy@example.test'], subject: 'Información', body: 'Hola Ángel,\n\nConfirmado.' }, {
      messageId: '<stable@novo.local>', inReplyTo: '<original@example.test>', references: '<older@example.test> <original@example.test>',
    })
    const mime = Buffer.from(raw, 'base64url').toString('utf8')
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(mime).toContain('Cc: copy@example.test')
    expect(mime).toContain('Message-ID: <stable@novo.local>')
    expect(mime).toContain('In-Reply-To: <original@example.test>')
    expect(mime).toContain(Buffer.from('Hola Ángel,\n\nConfirmado.').toString('base64'))
    expect(mime).not.toContain('text/html')
  })
})
