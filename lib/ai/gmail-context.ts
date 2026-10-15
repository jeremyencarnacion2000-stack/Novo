import { gmailService } from '@/lib/google'
import { findGoogleAccountForScopes } from '@/lib/google-account'

export type GmailContext = {
  status: 'available' | 'not_connected' | 'unavailable' | 'reauthorization_required'
  messages: Array<{ id: string; subject: string; from: string }>
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

export function shouldConsultGmail(message: string): boolean {
  return /\b(correos?|emails?|gmail|bandeja|inbox|mail)\b/i.test(message)
}

/**
 * Reads a small, request-scoped window of recent inbox messages for a user asking about email.
 * Bodies and snippets are deliberately excluded from the model context and
 * nothing from this result is persisted as a message archive.
 */
export async function getGmailContextForUser(userId: string, maxResults = 8): Promise<GmailContext> {
  const account = await findGoogleAccountForScopes(userId, ['gmail.readonly'])
  if (!account) return { status: 'not_connected', messages: [] }

  try {
    const emails = await gmailService.listRecentForUser(userId, maxResults)
    return {
      status: 'available',
      messages: emails.filter((email): email is typeof email & { id: string } => typeof email.id === 'string').map((email) => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
      })),
    }
  } catch (error) {
    if (isGmailReauthorizationError(error)) {
      return { status: 'reauthorization_required', messages: [] }
    }
    return { status: 'unavailable', messages: [] }
  }
}
