import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeGitHubCode } from '@/lib/github-oauth'
import { fetchGitHubProviderIdentity } from '@/lib/github-provider-identity'
import { hashOAuthNonce, parseIntegrationOAuthState } from '@/lib/todoist-oauth-state'

export const dynamic = 'force-dynamic'

function resultUrl(request: Request, status: 'connected' | 'error', reason?: string) {
  const url = new URL('/connectors', request.url)
  url.searchParams.set('githubStatus', status)
  if (reason) url.searchParams.set('reason', reason)
  return url
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.redirect(resultUrl(request, 'error', 'unauthenticated'))

  const params = new URL(request.url).searchParams
  const state = params.get('state')
  const code = params.get('code')
  const cookieStore = await cookies()
  const storedState = cookieStore.get('novo_github_oauth_state')?.value
  cookieStore.delete('novo_github_oauth_state')
  const payload = parseIntegrationOAuthState(state, 'github')
  if (!storedState || state !== storedState || !payload || payload.userId !== session.user.id) {
    return NextResponse.redirect(resultUrl(request, 'error', 'invalid_state'))
  }

  const claimed = await prisma.todoistOAuthState.updateMany({
    where: {
      provider: 'github',
      userId: session.user.id,
      nonceHash: hashOAuthNonce(payload.nonce),
      status: 'issued',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { status: 'consumed', consumedAt: new Date() },
  })
  if (claimed.count !== 1) return NextResponse.redirect(resultUrl(request, 'error', 'invalid_state'))
  if (params.get('error') || !code) return NextResponse.redirect(resultUrl(request, 'error', 'denied'))

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const redirectUri = process.env.GITHUB_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return NextResponse.redirect(resultUrl(request, 'error', 'unconfigured'))

  try {
    const token = await exchangeGitHubCode({ clientId, clientSecret, redirectUri }, code)
    const identity = await fetchGitHubProviderIdentity(token.accessToken)
    const existing = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'github' } },
      select: { metadata: true },
    })
    const existingMetadata = existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? existing.metadata as Record<string, unknown>
      : {}

    await prisma.integrationAccount.upsert({
      where: { userId_provider: { userId: session.user.id, provider: 'github' } },
      create: {
        userId: session.user.id,
        provider: 'github',
        providerAccountId: identity.providerAccountId,
        accessToken: token.accessToken,
        tokenType: token.tokenType,
        scope: token.scope,
        syncStatus: 'connected',
        metadata: { ...existingMetadata, login: identity.login, avatarUrl: identity.avatarUrl, repoCount: null },
      },
      update: {
        providerAccountId: identity.providerAccountId,
        accessToken: token.accessToken,
        tokenType: token.tokenType,
        scope: token.scope,
        syncStatus: 'connected',
        syncErrorCode: null,
        syncErrorMessage: null,
        metadata: { ...existingMetadata, login: identity.login, avatarUrl: identity.avatarUrl },
        updatedAt: new Date(),
      },
    })
    return NextResponse.redirect(resultUrl(request, 'connected'))
  } catch (error) {
    console.error('[GitHub Callback] Provider authorization failed:', { name: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.redirect(resultUrl(request, 'error', 'authorization_failed'))
  }
}
