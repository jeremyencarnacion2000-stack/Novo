import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { ArrowRight, BadgeCheck, Bot, Check, CircleAlert, KeyRound, LockKeyhole, UserRound } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { describeConsentDestination } from '@/lib/mcp/consent-destination'
import { getOidcProvider } from '@/lib/mcp/oidc-provider'
import { MCP_SCOPE_DESCRIPTIONS } from '@/lib/mcp/scopes'

function platformLabel(clientName: string) {
  const normalized = clientName.toLowerCase()
  if (normalized.includes('chatgpt') || normalized.includes('openai')) return 'ChatGPT'
  if (normalized.includes('claude')) return 'Claude'
  if (normalized.includes('codex')) return 'Codex'
  return clientName
}

export default async function ConsentPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const session = await getServerSession(authOptions)

  const provider = getOidcProvider()
  const interaction = await provider.Interaction.find(uid)
  if (!interaction) redirect('/')
  const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(`/oauth/consent/${uid}`)}`
  // Require an identity before showing the authorization controls. The login
  // callback is preserved so the user returns to this exact request instead of
  // being dropped on the dashboard.
  if (interaction.prompt.name === 'login' && !session?.user?.id) {
    redirect(signInUrl)
  }
  // Once the user is signed in, the normal OIDC login bridge resumes here.
  if (interaction.prompt.name === 'login' && session?.user?.id) {
    redirect(`/api/oauth/interaction/${uid}/login`)
  }

  const interactionParams = interaction.params as { client_id?: string; scope?: string; redirect_uri?: string }
  const clientId = interactionParams.client_id
  const client = clientId ? await provider.Client.find(clientId) : undefined
  const requestedScopes = (interactionParams.scope || '').split(' ').filter(Boolean)
  const clientName = client?.clientName || clientId || 'Aplicación externa'
  const destination = describeConsentDestination(interactionParams.redirect_uri || '')
  const isLocalCallback = destination.protocol === 'http:' && destination.isTrustedTransport
  const accountLabel = session?.user?.email || 'Inicia sesión para elegir tu cuenta'

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#080b0c] px-4 py-7 text-[#eff6f1] sm:px-7 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(183,243,208,0.14),transparent_30%),radial-gradient(circle_at_95%_90%,rgba(183,243,208,0.06),transparent_28%)]" />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between px-1 pb-8 sm:pb-10">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl border border-[#b7f3d0]/25 bg-[#b7f3d0]/10 text-[#b7f3d0]"><span className="text-sm font-black">N</span></div><span className="text-sm font-bold tracking-[0.18em] text-white/85">NOVO</span></div>
          <div className="flex items-center gap-2 text-xs font-medium text-white/45"><LockKeyhole className="size-3.5 text-[#b7f3d0]" />Autorización segura</div>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-white/[0.11] bg-[#0e1314]/95 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
          <div className="border-b border-white/[0.08] px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#b7f3d0]/25 bg-[#b7f3d0]/10 text-[#b7f3d0]"><Bot className="size-5" /></div>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b7f3d0]/80">Nueva conexión MCP</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Conectar {platformLabel(clientName)} a tu Twin</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Esta plataforma solicita acceso a Novo para usar las herramientas que selecciones. Puedes revocar el acceso cuando quieras.</p></div>
            </div>
          </div>

          <div className="grid divide-y divide-white/[0.08] md:grid-cols-[1.1fr_0.9fr] md:divide-x md:divide-y-0">
            <section className="p-5 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/90"><KeyRound className="size-4 text-[#b7f3d0]" />Permisos solicitados</div>
              <p className="mt-2 text-sm leading-6 text-white/48">Novo solo compartirá el acceso necesario para estas acciones.</p>
              <ul className="mt-5 space-y-3" aria-label="Permisos solicitados">
                {requestedScopes.length === 0 ? <li className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-white/50">No se solicitó ningún permiso utilizable.</li> : requestedScopes.map((scope) => <li key={scope} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#b7f3d0]/12 text-[#b7f3d0]"><Check className="size-3.5" /></span><span className="text-sm leading-5 text-white/80">{MCP_SCOPE_DESCRIPTIONS[scope] || scope}</span></li>)}
              </ul>
            </section>

            <aside className="bg-white/[0.018] p-5 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/90"><UserRound className="size-4 text-[#b7f3d0]" />Cuenta que autoriza</div>
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="text-xs text-white/40">{session?.user?.id ? 'Conectada como' : 'Cuenta requerida'}</p><p className="mt-1 truncate text-sm font-medium text-white/85">{accountLabel}</p>{!session?.user?.id ? <a href={signInUrl} className="mt-3 inline-flex text-xs font-semibold text-[#b7f3d0] underline-offset-4 hover:underline">Iniciar sesión para continuar <ArrowRight className="ml-1 size-3.5" /></a> : null}</div>

              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-white/90">{destination.isTrustedTransport ? <BadgeCheck className="size-4 text-[#b7f3d0]" /> : <CircleAlert className="size-4 text-amber-300" />}Destino de autorización</div>
              <div className={`mt-3 rounded-xl border p-4 ${destination.isTrustedTransport ? 'border-[#b7f3d0]/15 bg-[#b7f3d0]/[0.045]' : 'border-amber-300/25 bg-amber-300/[0.055]'}`}>
                <p className="font-mono text-xs break-all text-white/85">{destination.host}</p>
                <p className={`mt-2 text-xs leading-5 ${destination.isTrustedTransport ? 'text-white/48' : 'text-amber-100/75'}`}>{destination.isTrustedTransport ? (isLocalCallback ? 'Callback local de una aplicación de escritorio.' : 'Destino HTTPS verificado para esta conexión.') : 'Revisa este destino antes de autorizar. No parece usar un transporte seguro.'}</p>
              </div>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
            {session?.user?.id ? <><form method="POST" action={`/api/oauth/interaction/${uid}/confirm`}><button type="submit" name="allow" value="false" className="h-11 w-full rounded-xl border border-white/[0.13] px-5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06] sm:w-auto">Cancelar</button></form><form method="POST" action={`/api/oauth/interaction/${uid}/confirm`}><button type="submit" name="allow" value="true" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#b7f3d0] px-5 text-sm font-bold text-[#102018] transition-transform hover:brightness-95 active:scale-[0.98] sm:w-auto">Autorizar conexión <ArrowRight className="size-4" /></button></form></> : <a href={signInUrl} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#b7f3d0] px-5 text-sm font-bold text-[#102018] transition-transform hover:brightness-95 active:scale-[0.98] sm:w-auto">Iniciar sesión para autorizar <ArrowRight className="size-4" /></a>}
          </div>
          {session?.user?.id ? <p className="px-5 pb-5 text-center text-[11px] text-white/35 sm:px-8">Al autorizar, volverás automáticamente a la aplicación que inició esta conexión.</p> : null}
        </section>

        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-5 text-white/35">La autorización crea una sesión limitada para el servidor MCP de Novo. No compartimos tu contraseña ni tus integraciones externas con la plataforma.</p>
      </div>
    </main>
  )
}
