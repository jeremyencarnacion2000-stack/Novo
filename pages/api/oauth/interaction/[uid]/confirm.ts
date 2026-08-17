import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getOidcProvider } from '@/lib/mcp/oidc-provider'

// Handles the real Allow/Deny submission from app/oauth/consent/[uid]/page.tsx
// (a plain HTML <form method="POST">, so the browser follows oidc-provider's
// resulting redirect natively — no client-side fetch/redirect handling
// needed). Needs real Node req/res for interactionFinished, hence Pages Router.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed')
    return
  }

  const uid = String(req.query.uid || '')
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    res.redirect(302, `/auth/signin?callbackUrl=${encodeURIComponent(`/oauth/consent/${uid}`)}`)
    return
  }

  const provider = getOidcProvider()
  const interaction = await provider.interactionDetails(req, res)

  // The interaction's bound login session must match the browser's current
  // NextAuth identity — refuse rather than grant access under a stale or
  // mismatched session.
  if (!interaction.session || interaction.session.accountId !== session.user.id) {
    res.status(403).end('Session mismatch — please restart the authorization request.')
    return
  }

  const allow = req.body?.allow === 'true'

  if (!allow) {
    await provider.interactionFinished(
      req,
      res,
      { error: 'access_denied', error_description: 'El usuario rechazó la solicitud de acceso.' },
      { mergeWithLastSubmission: false }
    )
    return
  }

  const params = interaction.params as { client_id?: string; scope?: string; resource?: string | string[] }
  const clientId = params.client_id || ''
  const resource = Array.isArray(params.resource) ? params.resource[0] : params.resource
  const promptDetails = interaction.prompt.details as {
    missingOIDCScope?: string[]
    missingResourceScopes?: Record<string, string[]>
  }

  // oidc-provider distinguishes ordinary scopes from resource-indicator
  // scopes. Novo's MCP permissions are currently declared in `scopes`, so the
  // consent prompt reports them as missingOIDCScope. Persist exactly what the
  // prompt asks for; putting them only in `resources` makes the resume route
  // believe consent is still incomplete and opens the consent page again.
  const grant = interaction.grantId
    ? await provider.Grant.find(interaction.grantId)
    : new provider.Grant({ accountId: session.user.id, clientId })
  if (!grant) {
    res.status(500).end('Authorization grant could not be loaded.')
    return
  }
  if (promptDetails.missingOIDCScope?.length) {
    grant.addOIDCScope(promptDetails.missingOIDCScope.join(' '))
  }
  if (promptDetails.missingResourceScopes) {
    for (const [indicator, scopes] of Object.entries(promptDetails.missingResourceScopes)) {
      grant.addResourceScope(indicator, scopes.join(' '))
    }
  } else if (resource && params.scope && !promptDetails.missingOIDCScope?.length) {
    // Keep compatibility with a provider configuration that classifies MCP
    // permissions as resource scopes in a future release.
    grant.addResourceScope(resource, params.scope)
  }
  const grantId = await grant.save()

  // Finish through oidc-provider's native resume route. The provider then
  // returns the browser to the exact callback registered by the external
  // client (ChatGPT, Claude, Codex, mobile, etc.). Keeping this redirect
  // native avoids an intermediate page re-opening the consent interaction.
  await provider.interactionFinished(
    req,
    res,
    { consent: { grantId } },
    { mergeWithLastSubmission: true }
  )
}
