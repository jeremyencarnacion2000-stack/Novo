'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, KeyRound, Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

type DeviceToken = {
  id: string
  name: string
  tokenPrefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

const COPY = {
  es: {
    eyebrow: 'Acceso de agentes', title: 'Conecta un agente a Novo', description: 'Crea un token personal para que un dispositivo o agente consulte tus tareas pendientes y, solo si lo autorizas, pueda actualizarlas.',
    endpoint: 'Endpoint MCP', tokenName: 'Nombre del dispositivo', namePlaceholder: 'Ej. Codex en mi portátil', readOnly: 'Solo lectura de tareas', taskWrite: 'Permitir crear, actualizar y completar tareas', expiration: 'Expiración', create: 'Crear token', cancel: 'Cancelar', copy: 'Copiar', copied: 'Copiado', oneTime: 'Guarda este token ahora. Por seguridad, Novo no podrá mostrarlo de nuevo.',
    tokenCreated: 'Token creado', configuration: 'Configuración para el cliente', active: 'Tokens activos', empty: 'Aún no hay dispositivos conectados.', revoke: 'Revocar', revoked: 'Revocado', neverUsed: 'Aún no se usó', lastUsed: 'Último uso', expires: 'Vence', security: 'Cada token está vinculado a tu cuenta, tiene alcance limitado y puede revocarse en cualquier momento. No compartas este secreto en chats, capturas o repositorios.',
    readScope: 'Leer tareas pendientes', writeScope: 'Editar tareas', days: { '7': '7 días', '30': '30 días', '90': '90 días' }, error: 'No se pudo completar la acción. Inténtalo de nuevo.',
  },
  en: {
    eyebrow: 'Agent access', title: 'Connect an agent to Novo', description: 'Create a personal token so a device or agent can review pending tasks and, only when you allow it, update them.',
    endpoint: 'MCP endpoint', tokenName: 'Device name', namePlaceholder: 'e.g. Codex on my laptop', readOnly: 'Read pending tasks only', taskWrite: 'Allow creating, updating, and completing tasks', expiration: 'Expiry', create: 'Create token', cancel: 'Cancel', copy: 'Copy', copied: 'Copied', oneTime: 'Save this token now. Novo cannot show it again for security.',
    tokenCreated: 'Token created', configuration: 'Client configuration', active: 'Active tokens', empty: 'No connected devices yet.', revoke: 'Revoke', revoked: 'Revoked', neverUsed: 'Not used yet', lastUsed: 'Last used', expires: 'Expires', security: 'Each token is tied to your account, has limited scope, and can be revoked at any time. Never share this secret in chats, screenshots, or repositories.',
    readScope: 'Read pending tasks', writeScope: 'Edit tasks', days: { '7': '7 days', '30': '30 days', '90': '90 days' }, error: 'The action could not be completed. Please try again.',
  },
  fr: {
    eyebrow: 'Accès agent', title: 'Connecter un agent à Novo', description: 'Créez un jeton personnel pour qu’un appareil ou un agent consulte vos tâches en attente et, seulement si vous l’autorisez, les mette à jour.',
    endpoint: 'Point d’accès MCP', tokenName: 'Nom de l’appareil', namePlaceholder: 'Ex. Codex sur mon portable', readOnly: 'Lecture seule des tâches', taskWrite: 'Autoriser la création et la mise à jour', expiration: 'Expiration', create: 'Créer le jeton', cancel: 'Annuler', copy: 'Copier', copied: 'Copié', oneTime: 'Enregistrez ce jeton maintenant. Novo ne pourra pas l’afficher de nouveau.',
    tokenCreated: 'Jeton créé', configuration: 'Configuration client', active: 'Jetons actifs', empty: 'Aucun appareil connecté.', revoke: 'Révoquer', revoked: 'Révoqué', neverUsed: 'Pas encore utilisé', lastUsed: 'Dernière utilisation', expires: 'Expire', security: 'Chaque jeton est lié à votre compte, limité en portée et révocable à tout moment. Ne partagez jamais ce secret.',
    readScope: 'Lire les tâches en attente', writeScope: 'Modifier les tâches', days: { '7': '7 jours', '30': '30 jours', '90': '90 jours' }, error: 'Impossible de terminer cette action. Réessayez.',
  },
  de: {
    eyebrow: 'Agentenzugriff', title: 'Agent mit Novo verbinden', description: 'Erstelle ein persönliches Token, damit ein Gerät oder Agent offene Aufgaben einsehen und – nur mit deiner Freigabe – aktualisieren kann.',
    endpoint: 'MCP-Endpunkt', tokenName: 'Gerätename', namePlaceholder: 'z. B. Codex auf meinem Laptop', readOnly: 'Aufgaben nur lesen', taskWrite: 'Erstellen, aktualisieren und abschließen erlauben', expiration: 'Ablauf', create: 'Token erstellen', cancel: 'Abbrechen', copy: 'Kopieren', copied: 'Kopiert', oneTime: 'Speichere dieses Token jetzt. Novo kann es aus Sicherheitsgründen nicht erneut anzeigen.',
    tokenCreated: 'Token erstellt', configuration: 'Client-Konfiguration', active: 'Aktive Tokens', empty: 'Noch keine verbundenen Geräte.', revoke: 'Widerrufen', revoked: 'Widerrufen', neverUsed: 'Noch nicht verwendet', lastUsed: 'Zuletzt verwendet', expires: 'Läuft ab', security: 'Jedes Token ist an dein Konto gebunden, hat begrenzte Berechtigungen und kann jederzeit widerrufen werden. Teile dieses Geheimnis nie.',
    readScope: 'Offene Aufgaben lesen', writeScope: 'Aufgaben bearbeiten', days: { '7': '7 Tage', '30': '30 Tage', '90': '90 Tage' }, error: 'Die Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.',
  },
} as const

function localizedDate(value: string | null, locale: string) {
  if (!value) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Request failed (${response.status}). Please try again.`)
  }
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    throw new Error(`Request returned an invalid response (${response.status}). Please try again.`)
  }
}

export function SettingsMcpAccess() {
  const { language } = useTranslation()
  const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const copy = COPY[locale]
  const [tokens, setTokens] = useState<DeviceToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [allowTaskWrites, setAllowTaskWrites] = useState(false)
  const [allowTwinRead, setAllowTwinRead] = useState(false)
  const [allowIntegrationSync, setAllowIntegrationSync] = useState(false)
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const endpoint = useMemo(() => typeof window === 'undefined' ? '/api/mcp' : `${window.location.origin}/api/mcp`, [])

  const loadTokens = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/mcp/tokens', { cache: 'no-store' })
      if (!response.ok) throw new Error('load failed')
      const payload = await readJsonResponse(response)
      setTokens(Array.isArray(payload.tokens) ? payload.tokens as DeviceToken[] : [])
    } catch {
      setError(copy.error)
    } finally {
      setIsLoading(false)
    }
  }, [copy.error])

  useEffect(() => { void loadTokens() }, [loadTokens])

  const createToken = async () => {
    setError(null)
    setIsCreating(true)
    try {
      const response = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ name, allowTaskWrites, allowTwinRead, allowIntegrationSync, expiresInDays: days }),
      })
      const payload = await readJsonResponse(response)
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'create failed')
      if (typeof payload.token !== 'string') throw new Error(copy.error)
      setCreatedToken(payload.token)
      setName('')
      setAllowTaskWrites(false)
      setAllowTwinRead(false)
      setAllowIntegrationSync(false)
      await loadTokens()
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : copy.error)
    } finally {
      setIsCreating(false)
    }
  }

  const revokeToken = async (tokenId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/mcp/tokens/${tokenId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('revoke failed')
      await loadTokens()
    } catch {
      setError(copy.error)
    }
  }

  const copySecret = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const config = createdToken ? JSON.stringify({
    mcpServers: { novo: { url: endpoint, headers: { Authorization: `Bearer ${createdToken}` } } },
  }, null, 2) : ''

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28">
      <section className="rounded-[28px] border border-primary/20 bg-primary/[0.055] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.08)] sm:p-7">
        <div className="flex gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><KeyRound className="size-5" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/75">{copy.eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">{copy.description}</p>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-foreground/45">Cuando un dispositivo usa el endpoint MCP, Novo registra la acción con tu cuenta, respeta el alcance del token y la convierte en contexto para el Twin. Puedes revocar el acceso en cualquier momento.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-foreground/[0.08] bg-foreground/[0.025] p-5 sm:p-7">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground/80">
            {copy.tokenName}
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} maxLength={60} className="h-11 border-foreground/10 bg-background/40" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground/80">
            {copy.expiration}
            <select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)} className="h-11 rounded-xl border border-foreground/10 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value={7}>{copy.days['7']}</option><option value={30}>{copy.days['30']}</option><option value={90}>{copy.days['90']}</option>
            </select>
          </label>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/[0.07] bg-background/25 p-4">
          <input type="checkbox" checked={allowTaskWrites} onChange={(event) => setAllowTaskWrites(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
          <span><span className="block text-sm font-semibold text-foreground/80">{allowTaskWrites ? copy.taskWrite : copy.readOnly}</span><span className="mt-1 block text-xs leading-5 text-foreground/50">{copy.readScope}{allowTaskWrites ? ` · ${copy.writeScope}` : ''}</span></span>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/[0.07] bg-background/25 p-4">
            <input type="checkbox" checked={allowTwinRead} onChange={(event) => setAllowTwinRead(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span><span className="block text-sm font-semibold text-foreground/80">Permitir leer el contexto del Twin</span><span className="mt-1 block text-xs leading-5 text-foreground/50">twin:read</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/[0.07] bg-background/25 p-4">
            <input type="checkbox" checked={allowIntegrationSync} onChange={(event) => setAllowIntegrationSync(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span><span className="block text-sm font-semibold text-foreground/80">Permitir sincronizar fuentes conectadas</span><span className="mt-1 block text-xs leading-5 text-foreground/50">integrations:read · integrations:write</span></span>
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-foreground/45">Estas opciones permiten que el dispositivo consulte el estado del Twin y actualice señales de tus fuentes autorizadas. Son opcionales y revocables.</p>
        {error ? <p role="alert" className="mt-4 text-sm text-red-500">{error}</p> : null}
        <Button onClick={() => void createToken()} disabled={isCreating || !name.trim()} className="mt-5 h-11 rounded-xl px-5">
          {isCreating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}{copy.create}
        </Button>
      </section>

      {createdToken ? <section className="rounded-[28px] border border-emerald-500/25 bg-emerald-500/[0.06] p-5 sm:p-7" role="status">
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-300"><ShieldCheck className="size-5" /><h3 className="font-bold">{copy.tokenCreated}</h3></div>
        <p className="mt-3 text-sm leading-6 text-foreground/65">{copy.oneTime}</p>
        <div className="mt-4 rounded-2xl border border-foreground/10 bg-background/70 p-3 font-mono text-xs break-all text-foreground/85">{createdToken}</div>
        <div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copySecret(createdToken)}><Clipboard className="mr-2 size-4" />{copied ? copy.copied : copy.copy}</Button><Button variant="ghost" onClick={() => setCreatedToken(null)}>{copy.cancel}</Button></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">{copy.configuration}</p>
        <pre className="mt-2 overflow-x-auto rounded-2xl border border-foreground/10 bg-[#101111] p-4 text-xs leading-5 text-[#d9e4dc]">{config}</pre>
      </section> : null}

      <section className="rounded-[28px] border border-foreground/[0.08] bg-foreground/[0.02] p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4"><h3 className="font-bold text-foreground">{copy.active}</h3><code className="rounded-lg bg-foreground/[0.06] px-2 py-1 text-xs text-foreground/60">{endpoint}</code></div>
        {isLoading ? <div className="flex h-24 items-center justify-center text-foreground/40"><Loader2 className="size-5 animate-spin" /></div> : tokens.length === 0 ? <p className="py-8 text-sm text-foreground/45">{copy.empty}</p> : <div className="mt-4 divide-y divide-foreground/[0.06]">{tokens.map((token) => {
          const isRevoked = Boolean(token.revokedAt)
          return <div key={token.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground/85">{token.name}</p>{isRevoked ? <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">{copy.revoked}</span> : null}</div><p className="mt-1 font-mono text-xs text-foreground/45">{token.tokenPrefix}••••</p><p className="mt-1 text-xs text-foreground/45">{token.scopes.includes('tasks:write') ? copy.writeScope : copy.readScope} · {copy.expires}: {localizedDate(token.expiresAt, locale) ?? '—'} · {copy.lastUsed}: {localizedDate(token.lastUsedAt, locale) ?? copy.neverUsed}</p></div>{!isRevoked ? <Button variant="ghost" size="sm" onClick={() => void revokeToken(token.id)} className="self-start text-red-500 hover:bg-red-500/10 hover:text-red-500"><Trash2 className="mr-1.5 size-4" />{copy.revoke}</Button> : null}</div>
        })}</div>}
      </section>

      <aside className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm leading-6 text-foreground/65"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />{copy.security}</aside>
    </div>
  )
}
