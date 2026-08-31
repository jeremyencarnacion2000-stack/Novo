import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createIntegrationOAuthState, hashOAuthNonce, parseIntegrationOAuthState, INTEGRATION_OAUTH_STATE_TTL_MS } from '@/lib/todoist-oauth-state'
import { buildGitHubAuthorizationUrl } from '@/lib/github-oauth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = process.env.GITHUB_REDIRECT_URI
  if (!clientId || !redirectUri) {
    const url = new URL('/connectors', request.url)
    url.searchParams.set('integrationStatus', 'unconfigured')
    url.searchParams.set('provider', 'github')
    return NextResponse.redirect(url)
  }

  const state = createIntegrationOAuthState(session.user.id, 'github')
  const payload = parseIntegrationOAuthState(state, 'github')
  if (!payload) return NextResponse.json({ error: 'Unable to create OAuth state' }, { status: 503 })

  await prisma.todoistOAuthState.create({
    data: {
      provider: 'github',
      userId: session.user.id,
      nonceHash: hashOAuthNonce(payload.nonce),
      expiresAt: new Date(payload.issuedAt + INTEGRATION_OAUTH_STATE_TTL_MS),
    },
  })

  const cookieStore = await cookies()
  cookieStore.set('novo_github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: INTEGRATION_OAUTH_STATE_TTL_MS / 1000,
    path: '/',
  })

  return NextResponse.redirect(buildGitHubAuthorizationUrl({ clientId, redirectUri }, state))
}
