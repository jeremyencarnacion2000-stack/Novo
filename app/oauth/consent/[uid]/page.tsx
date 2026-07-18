import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOidcProvider } from '@/lib/mcp/oidc-provider'
import { MCP_SCOPE_DESCRIPTIONS } from '@/lib/mcp/scopes'

// The real MCP OAuth consent screen — not the generic NextAuth signin page.
// Reads the pending Interaction/Client straight out of Postgres via the same
// oidc-provider model classes the adapter is built on (provider.Interaction.find /
// provider.Client.find are plain async DB lookups, no Node req/res needed —
// unlike interactionFinished, which does need it and lives in
// pages/api/oauth/interaction/[uid]/{login,confirm}.ts instead).
export default async function ConsentPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/oauth/consent/${uid}`)}`)
  }

  const provider = getOidcProvider()
  const interaction = await provider.Interaction.find(uid)
  if (!interaction) {
    redirect('/')
  }

  // Not authenticated with oidc-provider yet — bounce through the silent
  // login bridge (trusts the NextAuth session above), which will land back
  // here (or on a fresh uid) once satisfied.
  if (interaction.prompt.name === 'login') {
    redirect(`/api/oauth/interaction/${uid}/login`)
  }

  const interactionParams = interaction.params as {
    client_id?: string
    scope?: string
    redirect_uri?: string
  }
  const clientId = interactionParams.client_id
  const client = clientId ? await provider.Client.find(clientId) : undefined
  const scopes = (interactionParams.scope || '').split(' ').filter(Boolean)
  const redirectUri = interactionParams.redirect_uri || ''

  let redirectHost = ''
  try {
    redirectHost = new URL(redirectUri).host
  } catch {
    // leave blank — shown as "destino desconocido" below
  }

  const clientName = client?.clientName || clientId || 'Aplicación externa'

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            N
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Novo Cognitive OS</p>
            <h1 className="text-lg font-semibold">Conceder acceso a {clientName}</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium text-foreground">{clientName}</span> quiere conectarse a tu
          cuenta de Novo ({session?.user?.email}). Podrá:
        </p>

        <ul className="space-y-2 mb-6">
          {scopes.length === 0 && (
            <li className="text-sm text-muted-foreground">Ningún permiso específico solicitado.</li>
          )}
          {scopes.map((scope) => (
            <li key={scope} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">✓</span>
              <span>{MCP_SCOPE_DESCRIPTIONS[scope] || scope}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 mb-6 text-xs text-muted-foreground">
          Al continuar, confías en que las credenciales se enviarán a{' '}
          <span className="font-mono">{redirectHost || 'un destino desconocido'}</span>. Solo autoriza
          esto si iniciaste esta conexión tú mismo.
        </div>

        <form method="POST" action={`/api/oauth/interaction/${uid}/confirm`} className="flex gap-3">
          <button
            type="submit"
            name="allow"
            value="false"
            className="flex-1 h-10 rounded-[14px] border border-border bg-background text-sm font-medium hover:bg-accent transition-colors"
          >
            Denegar
          </button>
          <button
            type="submit"
            name="allow"
            value="true"
            className="flex-1 h-10 rounded-[14px] bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Permitir
          </button>
        </form>
      </div>
    </div>
  )
}
