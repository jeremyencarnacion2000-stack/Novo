import { gmailService } from '@/lib/google'
import { findGoogleAccountForScopes } from '@/lib/google-account'
import { planMailboxRead, type MailHistory } from './mailbox-plan'

export type GmailContext = {
  status: 'available' | 'not_connected' | 'unavailable' | 'reauthorization_required'
  messages: Array<Awaited<ReturnType<typeof gmailService.readMessageForUser>>>
  query?: string
  hasMore?: boolean
  threadTruncated?: boolean
}

export function shouldIncludeGmailSignal(
  mailboxWasRequested: boolean,
  freshness: 'fresh' | 'stale',
): boolean {
  return !mailboxWasRequested && freshness === 'fresh'
}

/** Google can keep a stale scope in an OAuth account row after a basic login
 * replaces its access token. Treat an explicit authorization failure as a
 * renewal request, not as a transient provider outage. */
export function isGmailReauthorizationError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown
    errors?: Array<{ reason?: unknown }>
    response?: { status?: unknown; data?: { error?: string | { status?: string; errors?: Array<{ reason?: unknown }> } } }
  } | null
  const status = Number(candidate?.code ?? candidate?.response?.status)
  const providerError = candidate?.response?.data?.error
  const providerCode = typeof providerError === 'string' ? providerError : providerError?.status
  const reasons = [
    ...(candidate?.errors ?? []).map((item) => String(item.reason ?? '')),
    ...(typeof providerError === 'object' ? providerError.errors ?? [] : []).map((item) => String(item.reason ?? '')),
  ]
  const errorCodes = [providerCode, candidate?.code]
    .filter((code): code is string => typeof code === 'string')
    .map((code) => code.toLowerCase())
  return status === 401
    || (status === 403 && reasons.includes('insufficientPermissions'))
    || errorCodes.some((code) => code === 'invalid_grant' || code === 'invalid_token')
}

export function shouldConsultGmail(message: string, history: MailHistory = []): boolean {
  const normalized = message.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (/\b(correos?|emails?|gmail|bandeja|inbox|mail|mensajes?\s+de)\b/i.test(normalized)
    || /\b(respondio|respondieron|respondido|contesto|contestaron|escribio|replied|answered|wrote|heard\s+from|get\s+back\s+to)\b/i.test(normalized)
    || /\b(?:did|has|have)\b.*\b(?:reply|answer)\b/i.test(normalized)) return true
  const followUp = /respond|respuest|cont[eé]st|contesta|r[eé]sp[oó]nd|l[eé]e(?:lo|la)?\b|segund[oa]|primer[oa]|[uú]ltim[oa]|hilo|conversaci[oó]n|remitente|adjunt|redact|env[ií]a|mand[aá]/i.test(message)
  return followUp && history.slice(-6).some(item => /\b(correos?|emails?|gmail|bandeja|inbox|mail)\b/i.test(item.content))
}

/**
 * Request-scoped full-body evidence for the user's question. Contents are never
 * persisted as a mailbox archive and must be treated as untrusted source data.
 */
export async function getGmailContextForUser(userId: string, options: { message?: string; history?: MailHistory; signal?: AbortSignal } = {}): Promise<GmailContext> {
  const account = await findGoogleAccountForScopes(userId, ['gmail.readonly'])
  if (!account) return { status: 'not_connected', messages: [] }

  try {
    const plan = await planMailboxRead(options.message ?? '', options.history, options.signal)
    const result = await gmailService.searchForUser(userId, { query: plan.query, maxResults: plan.maxResults, bodyLimit: 20_000, signal: options.signal })
    let emails = result.messages
    let threadTruncated = false
    if (plan.expandThread && emails[0]?.threadId) {
      const thread = await gmailService.readThreadForUser(userId, emails[0].threadId, { bodyLimit: 20_000, signal: options.signal })
      const ids = new Set(thread.messages.map(item => item.id))
      emails = [...thread.messages, ...emails.filter(item => !ids.has(item.id))]
      threadTruncated = thread.threadTruncated
    }
    let remaining = 60_000
    const messages = emails.filter(email => email.id).map(email => {
      const body = (email.body ?? '').slice(0, remaining)
      remaining -= body.length
      return { ...email, body, bodyTruncated: email.bodyTruncated || body.length < (email.body?.length ?? 0) }
    })
    return {
      status: 'available',
      messages, query: plan.query, hasMore: Boolean(result.nextPageToken), threadTruncated,
    }
  } catch (error) {
    if (isGmailReauthorizationError(error)) {
      return { status: 'reauthorization_required', messages: [] }
    }
    return { status: 'unavailable', messages: [] }
  }
}
