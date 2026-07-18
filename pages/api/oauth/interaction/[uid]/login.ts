import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getOidcProvider } from '@/lib/mcp/oidc-provider'

// Silent login bridge: oidc-provider tracks its own "session" separate from
// NextAuth. Rather than build a second username/password screen, this trusts
// the user's existing Novo (NextAuth) session and immediately completes the
// oidc-provider 'login' prompt with that identity, then lets oidc-provider's
// own redirect chain carry the browser back into the flow (which will land on
// the consent prompt next). Requires a real Node req/res (interactionFinished
// needs the interaction cookie), so this lives in Pages Router, not App Router.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const uid = String(req.query.uid || '')
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.id) {
    res.redirect(302, `/auth/signin?callbackUrl=${encodeURIComponent(`/oauth/consent/${uid}`)}`)
    return
  }

  const provider = getOidcProvider()
  const interaction = await provider.interactionDetails(req, res)

  if (interaction.prompt.name !== 'login') {
    res.redirect(302, `/oauth/consent/${uid}`)
    return
  }

  await provider.interactionFinished(
    req,
    res,
    { login: { accountId: session.user.id } },
    { mergeWithLastSubmission: false }
  )
}
