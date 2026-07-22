'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/lib/settings-context'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Link2, RefreshCw, Upload, Database, Search, ChevronLeft, ChevronRight,
  Plus, Trash2, Sparkles, BookOpen,
} from 'lucide-react'
import type { IconType } from 'react-icons'
import {
  SiNotion, SiGoogledrive, SiGmail, SiGoogle, SiSlack, SiGithub, SiWhatsapp,
  SiGooglecalendar, SiGooglefit, SiSpotify, SiYoutube, SiTodoist, SiTrello,
  SiLinear, SiObsidian, SiDiscord, SiStrava, SiFitbit, SiApplemusic, SiApple,
} from 'react-icons/si'

// ── Real brand logos via Simple Icons (react-icons/si). Each renders the
//    platform's actual mark in its official brand color, so the marketplace
//    reads like a real integrations catalog instead of generic glyphs.
//    Notion/GitHub are pure-black brands, so they use the app foreground to
//    stay visible on the dark UI. ─────────────────────────────────────────────
function BrandIcon({ icon: Icon, color }: { icon: IconType; color?: string }) {
  return <Icon className="w-4 h-4" style={color ? { color } : undefined} />
}

// ── Status ─────────────────────────────────────────────────────────────────
type ConnectorStatus = 'connected' | 'available' | 'soon' | 'pending'

interface Connector {
  id: string
  category: 'productivity' | 'wellness' | 'knowledge' | 'music' | 'custom'
  name: string
  description: string
  detail: string
  /** 2-3 genuinely real things this connector does today — no padding. */
  capabilities?: string[]
  icon: React.ReactNode
  status: ConnectorStatus
  /** For custom API connectors only. */
  baseUrl?: string
}

const CATEGORIES: { id: Connector['category']; label: string; description: string }[] = [
  { id: 'productivity', label: 'Productividad', description: 'Tareas, documentos y flujos de trabajo.' },
  { id: 'wellness', label: 'Salud y bienestar', description: 'Actividad, sueño y tiempo bloqueado en tu calendario.' },
  { id: 'knowledge', label: 'Conocimiento', description: 'Libros y fuentes de referencia.' },
  { id: 'music', label: 'Música', description: 'Reproducción y bibliotecas musicales.' },
  { id: 'custom', label: 'Personalizados', description: 'Tus propias integraciones vía API.' },
]

const PAGE_SIZE = 4

function StatusPill({ status }: { status: ConnectorStatus }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Conectado
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Activación pendiente
      </span>
    )
  }
  if (status === 'available') {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-foreground/5 text-foreground/60 border border-foreground/10">
        <Link2 className="w-2.5 h-2.5" />
        Conectar
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-foreground/5 text-foreground/30 border border-foreground/8">
      <span className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
      Próximamente
    </span>
  )
}

function ConnectorCard({ connector, onClick }: { connector: Connector; onClick: () => void }) {
  const isSoon = connector.status === 'soon'
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl border p-4 flex flex-col gap-4 transition-all duration-300',
        isSoon
          ? 'border-foreground/[0.05] bg-foreground/[0.01] opacity-60 cursor-default'
          : 'border-foreground/[0.06] bg-foreground/[0.015] hover:bg-foreground/[0.04] hover:border-foreground/10 cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'w-10 h-10 rounded-xl bg-foreground/5 border border-foreground/8 flex items-center justify-center flex-shrink-0',
            isSoon && 'grayscale opacity-50',
          )}
        >
          {connector.icon}
        </div>
        <StatusPill status={connector.status} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/85">{connector.name}</p>
        <p className="text-xs text-foreground/35 mt-1 leading-relaxed">{connector.description}</p>
      </div>
    </button>
  )
}

// ── One category section — paginates in place (no layout reflow, no new
//    "browse all" view) once there are more cards than fit on a row. ────────
function CategorySection({
  category, items, onCardClick,
}: {
  category: { id: string; label: string; description: string }
  items: Connector[]
  onCardClick: (c: Connector) => void
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const visible = items.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30">{category.label}</p>
          <p className="text-xs text-foreground/30 mt-1">{category.description}</p>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-foreground/10 text-foreground/50 hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-default transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-foreground/10 text-foreground/50 hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-default transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map(connector => (
          <ConnectorCard key={connector.id} connector={connector} onClick={() => onCardClick(connector)} />
        ))}
      </div>
    </div>
  )
}

export function ConnectorsClient() {
  const { toast } = useToast()
  const { settings } = useSettings()
  const { data: session } = useSession()

  // ── Notion state (moved verbatim from settings-integrations.tsx) ───────────
  const [notionStatus, setNotionStatus] = useState<{
    connected: boolean
    workspaceName?: string | null
    databaseIds?: string[]
    connectedAt?: string
  } | null>(null)
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionSyncing, setNotionSyncing] = useState(false)
  const [notionDbs, setNotionDbs] = useState<{ id: string; title: string }[]>([])
  const [notionDbsOpen, setNotionDbsOpen] = useState(false)

  // ── Todoist state (mirrors Notion's shape exactly) ──────────────────────────
  const [todoistStatus, setTodoistStatus] = useState<{
    connected: boolean
    projectIds?: string[]
    connectedAt?: string
  } | null>(null)
  const [todoistLoading, setTodoistLoading] = useState(false)
  const [todoistSyncing, setTodoistSyncing] = useState(false)
  const [todoistProjects, setTodoistProjects] = useState<{ id: string; title: string }[]>([])
  const [todoistProjectsOpen, setTodoistProjectsOpen] = useState(false)

  // ── Slack state (channel picker instead of database/project picker, and
  //    a test message instead of a sync — Slack is a delivery channel) ──────
  const [slackStatus, setSlackStatus] = useState<{
    connected: boolean
    teamName?: string | null
    channelId?: string | null
    channelName?: string | null
  } | null>(null)
  const [slackLoading, setSlackLoading] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)
  const [slackChannels, setSlackChannels] = useState<{ id: string; title: string }[]>([])
  const [slackChannelsOpen, setSlackChannelsOpen] = useState(false)

  // ── Drive state ──────────────────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; hasScope: boolean } | null>(null)
  const [driveBackingUp, setDriveBackingUp] = useState(false)

  // ── Calendar state ───────────────────────────────────────────────────────
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; hasScope: boolean } | null>(null)
  const [calendarSyncing, setCalendarSyncing] = useState(false)

  // ── Gmail state ──────────────────────────────────────────────────────────
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; hasScope: boolean } | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [unreadEmails, setUnreadEmails] = useState<{ id?: string | null; subject: string; from: string; snippet?: string | null }[] | null>(null)

  // ── Google/Spotify grant status (Contacts, Books, YouTube ride the same
  //    Google consent; Spotify is its own provider) ───────────────────────────
  const [grantStatus, setGrantStatus] = useState<{ google: boolean; spotify: boolean } | null>(null)

  // ── Custom API connectors — saved via /api/integration/custom, presented
  //    honestly as "activación pendiente" since nothing calls them yet ───────
  const [customConnectors, setCustomConnectors] = useState<{ provider: string; name: string; baseUrl: string }[]>([])
  const [addCustomOpen, setAddCustomOpen] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const refreshCustomConnectors = () => {
    fetch('/api/integration/custom').then(r => r.json()).then(d => setCustomConnectors(d.connectors ?? [])).catch(() => {})
  }

  // Handle ?notionStatus= query param from OAuth callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ns = params.get('notionStatus')
    if (ns === 'connected') {
      // "Vinculado a Novo" used to read as "done" - but nothing actually
      // syncs until the user separately opens "Gestionar bases de datos"
      // and picks at least one, a step this toast didn't mention at all.
      // Auto-opening that panel (below) turns the required next step into
      // the natural continuation of connecting, instead of a secondary
      // control easy to never notice.
      toast({ title: 'Notion conectado', description: 'Elige qué bases de datos quieres sincronizar.' })
      handleFetchNotionDbs()
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      window.history.replaceState({}, '', url.toString())
    } else if (ns === 'error') {
      const reason = params.get('reason') ?? 'unknown'
      toast({ title: 'Falló la conexión con Notion', description: `Motivo: ${reason}`, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Handle ?todoistStatus= query param from OAuth callback redirect (mirrors Notion)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ts = params.get('todoistStatus')
    if (ts === 'connected') {
      toast({ title: 'Todoist conectado', description: 'Elige qué proyectos quieres sincronizar.' })
      handleFetchTodoistProjects()
      const url = new URL(window.location.href)
      url.searchParams.delete('todoistStatus')
      window.history.replaceState({}, '', url.toString())
    } else if (ts === 'error') {
      const reason = params.get('reason') ?? 'unknown'
      toast({ title: 'Falló la conexión con Todoist', description: `Motivo: ${reason}`, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('todoistStatus')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Handle ?slackStatus= query param from OAuth callback redirect (mirrors Notion/Todoist)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ss = params.get('slackStatus')
    if (ss === 'connected') {
      toast({ title: 'Slack conectado', description: 'Elige a qué canal quieres que lleguen las alertas.' })
      handleFetchSlackChannels()
      const url = new URL(window.location.href)
      url.searchParams.delete('slackStatus')
      window.history.replaceState({}, '', url.toString())
    } else if (ss === 'error') {
      const reason = params.get('reason') ?? 'unknown'
      toast({ title: 'Falló la conexión con Slack', description: `Motivo: ${reason}`, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('slackStatus')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // The auto-open-panel fix above only fires on a FRESH connect redirect -
  // it does nothing for an account that was already connected with 0
  // databases selected before that fix shipped (exactly the state a
  // founder screenshot showed after the first fix: still connected, still
  // 0 seleccionadas, because they'd connected days earlier and never
  // manually opened "Gestionar bases de datos"). This catches that case
  // too, once per page load (autoPromptedRef guards against reopening a
  // panel the user deliberately closed while still mid-selection).
  const autoPromptedRef = useRef(false)
  useEffect(() => {
    if (autoPromptedRef.current) return
    if (notionStatus?.connected && (notionStatus.databaseIds?.length ?? 0) === 0 && !notionDbsOpen) {
      autoPromptedRef.current = true
      handleFetchNotionDbs()
    }
  }, [notionStatus])

  const autoPromptedTodoistRef = useRef(false)
  useEffect(() => {
    if (autoPromptedTodoistRef.current) return
    if (todoistStatus?.connected && (todoistStatus.projectIds?.length ?? 0) === 0 && !todoistProjectsOpen) {
      autoPromptedTodoistRef.current = true
      handleFetchTodoistProjects()
    }
  }, [todoistStatus])

  const autoPromptedSlackRef = useRef(false)
  useEffect(() => {
    if (autoPromptedSlackRef.current) return
    if (slackStatus?.connected && !slackStatus.channelId && !slackChannelsOpen) {
      autoPromptedSlackRef.current = true
      handleFetchSlackChannels()
    }
  }, [slackStatus])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/integration/notion').then(r => r.json()).then(setNotionStatus).catch(() => setNotionStatus({ connected: false }))
    fetch('/api/integration/todoist').then(r => r.json()).then(setTodoistStatus).catch(() => setTodoistStatus({ connected: false }))
    fetch('/api/integration/slack').then(r => r.json()).then(setSlackStatus).catch(() => setSlackStatus({ connected: false }))
    fetch('/api/integration/drive').then(r => r.json()).then(setDriveStatus).catch(() => setDriveStatus({ connected: false, hasScope: false }))
    fetch('/api/integration/calendar').then(r => r.json()).then(setCalendarStatus).catch(() => setCalendarStatus({ connected: false, hasScope: false }))
    fetch('/api/integration/gmail').then(r => r.json()).then(setGmailStatus).catch(() => setGmailStatus({ connected: false, hasScope: false }))
    fetch('/api/integration/status').then(r => r.json()).then(setGrantStatus).catch(() => setGrantStatus({ google: false, spotify: false }))
    refreshCustomConnectors()
  }, [session?.user?.id])

  // ── Notion helpers (verbatim) ───────────────────────────────────────────────
  const handleNotionConnect = () => { window.location.href = '/api/integration/notion/connect' }

  const handleNotionDisconnect = async () => {
    setNotionLoading(true)
    try {
      await fetch('/api/integration/notion', { method: 'DELETE' })
      setNotionStatus({ connected: false })
      toast({ title: 'Notion desconectado' })
    } catch {
      toast({ title: 'No se pudo desconectar', variant: 'destructive' })
    } finally {
      setNotionLoading(false)
    }
  }

  const handleNotionSync = async () => {
    setNotionSyncing(true)
    try {
      const res = await fetch('/api/integration/notion?action=sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      toast({ title: `${data.total} tareas sincronizadas desde Notion`, description: `${data.created} creadas, ${data.updated} actualizadas` })
    } catch (err: any) {
      toast({ title: 'Falló la sincronización', description: err.message, variant: 'destructive' })
    } finally {
      setNotionSyncing(false)
    }
  }

  const handleFetchNotionDbs = async () => {
    if (notionDbsOpen) { setNotionDbsOpen(false); return }
    try {
      const res = await fetch('/api/integration/notion?action=databases', { method: 'POST' })
      const data = await res.json()
      setNotionDbs(data.databases || [])
      setNotionDbsOpen(true)
    } catch {
      toast({ title: 'No se pudieron cargar las bases de datos', variant: 'destructive' })
    }
  }

  const handleSaveNotionDbs = async (ids: string[]) => {
    try {
      const res = await fetch('/api/integration/notion?action=save_databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseIds: ids }),
      })
      if (!res.ok) throw new Error('Save failed')
      setNotionStatus(prev => prev ? { ...prev, databaseIds: ids } : prev)
      toast({ title: 'Bases de datos guardadas' })
    } catch {
      toast({ title: 'No se pudieron guardar las bases de datos', variant: 'destructive' })
    }
  }

  // ── Todoist helpers (mirror Notion's exactly) ───────────────────────────────
  const handleTodoistConnect = () => { window.location.href = '/api/integration/todoist/connect' }

  const handleTodoistDisconnect = async () => {
    setTodoistLoading(true)
    try {
      await fetch('/api/integration/todoist', { method: 'DELETE' })
      setTodoistStatus({ connected: false })
      toast({ title: 'Todoist desconectado' })
    } catch {
      toast({ title: 'No se pudo desconectar', variant: 'destructive' })
    } finally {
      setTodoistLoading(false)
    }
  }

  const handleTodoistSync = async () => {
    setTodoistSyncing(true)
    try {
      const res = await fetch('/api/integration/todoist?action=sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      toast({ title: `${data.total} tareas sincronizadas desde Todoist`, description: `${data.created} creadas, ${data.updated} actualizadas` })
    } catch (err: any) {
      toast({ title: 'Falló la sincronización', description: err.message, variant: 'destructive' })
    } finally {
      setTodoistSyncing(false)
    }
  }

  const handleFetchTodoistProjects = async () => {
    if (todoistProjectsOpen) { setTodoistProjectsOpen(false); return }
    try {
      const res = await fetch('/api/integration/todoist?action=projects', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch projects')
      setTodoistProjects(data.projects || [])
      setTodoistProjectsOpen(true)
    } catch {
      toast({ title: 'No se pudieron cargar los proyectos', variant: 'destructive' })
    }
  }

  const handleSaveTodoistProjects = async (ids: string[]) => {
    try {
      const res = await fetch('/api/integration/todoist?action=save_projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: ids }),
      })
      if (!res.ok) throw new Error('Save failed')
      setTodoistStatus(prev => prev ? { ...prev, projectIds: ids } : prev)
      toast({ title: 'Proyectos guardados' })
    } catch {
      toast({ title: 'No se pudieron guardar los proyectos', variant: 'destructive' })
    }
  }

  // ── Slack helpers (channel picker + test message, not a sync) ──────────────
  const handleSlackConnect = () => { window.location.href = '/api/integration/slack/connect' }

  const handleSlackDisconnect = async () => {
    setSlackLoading(true)
    try {
      await fetch('/api/integration/slack', { method: 'DELETE' })
      setSlackStatus({ connected: false })
      toast({ title: 'Slack desconectado' })
    } catch {
      toast({ title: 'No se pudo desconectar', variant: 'destructive' })
    } finally {
      setSlackLoading(false)
    }
  }

  const handleSlackTest = async () => {
    setSlackTesting(true)
    try {
      const res = await fetch('/api/integration/slack?action=test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      toast({ title: 'Mensaje de prueba enviado', description: 'Revisa el canal en Slack.' })
    } catch (err: any) {
      toast({ title: 'Falló el envío', description: err.message, variant: 'destructive' })
    } finally {
      setSlackTesting(false)
    }
  }

  const handleFetchSlackChannels = async () => {
    if (slackChannelsOpen) { setSlackChannelsOpen(false); return }
    try {
      const res = await fetch('/api/integration/slack?action=channels', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch channels')
      setSlackChannels(data.channels || [])
      setSlackChannelsOpen(true)
    } catch {
      toast({ title: 'No se pudieron cargar los canales', variant: 'destructive' })
    }
  }

  const handleSaveSlackChannel = async (channelId: string, channelName: string) => {
    try {
      const res = await fetch('/api/integration/slack?action=save_channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, channelName }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSlackStatus(prev => prev ? { ...prev, channelId, channelName } : prev)
      setSlackChannelsOpen(false)
      toast({ title: 'Canal guardado', description: channelName })
    } catch {
      toast({ title: 'No se pudo guardar el canal', variant: 'destructive' })
    }
  }

  // ── Drive helper (verbatim) ──────────────────────────────────────────────
  const handleDriveBackup = async () => {
    setDriveBackingUp(true)
    try {
      const res = await fetch('/api/integration/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Backup failed')
      toast({ title: 'Respaldo guardado en Drive', description: data.fileName })
    } catch (err: any) {
      toast({ title: 'Falló el respaldo en Drive', description: err.message, variant: 'destructive' })
    } finally {
      setDriveBackingUp(false)
    }
  }

  // ── Calendar helper (mirrors handleDriveBackup) ─────────────────────────
  const handleCalendarSync = async () => {
    setCalendarSyncing(true)
    try {
      const res = await fetch('/api/integration/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_from_google' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      toast({ title: `${data.total} eventos importados desde Google Calendar`, description: `${data.created} nuevos, ${data.updated} actualizados` })
    } catch (err: any) {
      toast({ title: 'Falló la sincronización con Calendar', description: err.message, variant: 'destructive' })
    } finally {
      setCalendarSyncing(false)
    }
  }

  // ── Gmail helper (read-only, no persistence — results just render inline
  //    in the detail dialog for the current session) ──────────────────────
  const handleGmailListUnread = async () => {
    setGmailLoading(true)
    try {
      const res = await fetch('/api/integration/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_unread' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch unread emails')
      setUnreadEmails(data.emails ?? [])
    } catch (err: any) {
      toast({ title: 'No se pudieron cargar los correos', description: err.message, variant: 'destructive' })
    } finally {
      setGmailLoading(false)
    }
  }

  // ── Custom connector helpers ─────────────────────────────────────────────
  const handleDeleteCustom = async (provider: string) => {
    await fetch(`/api/integration/custom?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' })
    setSelectedId(null)
    refreshCustomConnectors()
    toast({ title: 'Conector personalizado eliminado' })
  }

  // ── Catalog — built from live status so a card never claims a state that
  //    isn't real ────────────────────────────────────────────────────────────
  const connectors = useMemo<Connector[]>(() => {
    const googleConnected = grantStatus?.google ?? false
    const spotifyConnected = grantStatus?.spotify ?? false
    const driveReady = !!driveStatus?.connected && !!driveStatus?.hasScope

    const custom: Connector[] = customConnectors.map(c => ({
      id: c.provider,
      category: 'custom',
      name: c.name,
      description: c.baseUrl,
      detail: `Conector API personalizado guardado. Aún no hay lógica en Novo que lo llame — queda listo para activarse.`,
      icon: <Sparkles className="w-4 h-4 text-violet-400" />,
      status: 'pending',
      baseUrl: c.baseUrl,
    }))

    return [
      {
        id: 'notion',
        category: 'productivity',
        name: 'Notion',
        description: 'Importa tareas y páginas de tus bases de datos de Notion.',
        detail: 'Sincroniza databases de Notion como checklist items en Novo. Elige qué bases de datos importar y vuelve a sincronizar cuando quieras.',
        capabilities: [
          'Sincroniza tus bases de datos de Notion como tareas en Novo',
          'Elige exactamente qué bases de datos importar',
          'Vuelve a sincronizar cuando quieras con un clic',
        ],
        icon: <BrandIcon icon={SiNotion} />,
        status: notionStatus?.connected ? 'connected' : 'available',
      },
      {
        id: 'drive',
        category: 'productivity',
        name: 'Google Drive',
        description: 'Respalda tu workspace completo (tareas, rutinas, proyectos) en tu Drive.',
        detail: 'Genera un archivo de respaldo con tus datos de Novo y lo sube a tu Google Drive bajo demanda.',
        capabilities: [
          'Genera un respaldo de tus tareas, rutinas y proyectos',
          'Sube el respaldo directamente a tu Google Drive bajo demanda',
        ],
        icon: <BrandIcon icon={SiGoogledrive} color="#0066DA" />,
        status: driveReady ? 'connected' : 'available',
      },
      {
        id: 'contacts',
        category: 'productivity',
        name: 'Google Contacts',
        description: 'Consulta tus contactos de Google desde el módulo de Negocios.',
        detail: 'Usa el mismo permiso de tu cuenta de Google para mostrar tus contactos en la sección de Negocios.',
        capabilities: [
          'Muestra tus contactos de Google en el módulo de Negocios',
        ],
        icon: <BrandIcon icon={SiGoogle} color="#4285F4" />,
        status: googleConnected ? 'connected' : 'available',
      },
      {
        id: 'gmail',
        category: 'productivity',
        name: 'Gmail',
        description: 'Lee tus correos no leídos y deja que el Twin envíe correos por ti.',
        detail: 'Consulta tus correos no leídos directamente en Novo, y pídele al Twin en el chat que envíe correos en tu nombre.',
        capabilities: [
          'Lee tus correos no leídos',
          'El Twin puede enviar correos en tu nombre cuando se lo pidas en el chat',
        ],
        icon: <BrandIcon icon={SiGmail} color="#EA4335" />,
        status: (gmailStatus?.connected && gmailStatus?.hasScope) ? 'connected' : 'available',
      },
      {
        id: 'slack',
        category: 'productivity',
        name: 'Slack',
        description: 'Recibe alertas cognitivas en tu workspace de Slack.',
        detail: 'Elige un canal y el motor cognitivo te envía ahí sus alertas importantes (sobrecarga, patrones de abandono, etc.) el mismo día que las detecta.',
        capabilities: [
          'Elige a qué canal de Slack llegan las alertas',
          'Recibe alertas del motor cognitivo el mismo día que se detectan',
          'Envía un mensaje de prueba para confirmar que quedó bien configurado',
        ],
        icon: <BrandIcon icon={SiSlack} color="#4A154B" />,
        status: slackStatus?.connected ? 'connected' : 'available',
      },
      {
        id: 'github',
        category: 'productivity',
        name: 'GitHub',
        description: 'Convierte issues y PRs en tareas dentro de Novo.',
        detail: 'Sincroniza issues y pull requests asignados como tareas rastreables en Novo.',
        icon: <BrandIcon icon={SiGithub} />,
        status: 'soon',
      },
      {
        id: 'whatsapp',
        category: 'productivity',
        name: 'WhatsApp Business',
        description: 'Gestiona conversaciones de clientes desde Novo.',
        detail: 'Requiere verificación de Meta Business para la API de WhatsApp Business — un proceso que Meta hace directamente con la empresa dueña de la cuenta, no algo que Novo pueda activar por su cuenta. Queda documentado como pendiente hasta completar esa verificación.',
        icon: <BrandIcon icon={SiWhatsapp} color="#25D366" />,
        status: 'pending',
      },
      {
        id: 'trello',
        category: 'productivity',
        name: 'Trello',
        description: 'Sincroniza tarjetas de tus tableros como tareas en Novo.',
        detail: 'Trae tarjetas asignadas de tus tableros de Trello como tareas rastreables en Novo.',
        icon: <BrandIcon icon={SiTrello} color="#0052CC" />,
        status: 'soon',
      },
      {
        id: 'todoist',
        category: 'productivity',
        name: 'Todoist',
        description: 'Importa tus tareas pendientes de Todoist.',
        detail: 'Sincroniza proyectos de Todoist como tareas en Novo. Elige qué proyectos importar y vuelve a sincronizar cuando quieras.',
        capabilities: [
          'Sincroniza tus proyectos de Todoist como tareas en Novo',
          'Elige exactamente qué proyectos importar',
          'Marcar una tarea como completada en Novo también la completa en Todoist',
        ],
        icon: <BrandIcon icon={SiTodoist} color="#E44332" />,
        status: todoistStatus?.connected ? 'connected' : 'available',
      },
      {
        id: 'linear',
        category: 'productivity',
        name: 'Linear',
        description: 'Convierte issues asignados en tareas dentro de Novo.',
        detail: 'Sincroniza issues de Linear asignados a ti como tareas rastreables en Novo.',
        icon: <BrandIcon icon={SiLinear} color="#5E6AD2" />,
        status: 'soon',
      },
      {
        id: 'discord',
        category: 'productivity',
        name: 'Discord',
        description: 'Recibe alertas cognitivas en tu servidor de Discord.',
        detail: 'Notificaciones del motor cognitivo entregadas directamente a un canal de Discord.',
        icon: <BrandIcon icon={SiDiscord} color="#5865F2" />,
        status: 'soon',
      },
      {
        id: 'calendar',
        category: 'wellness',
        name: 'Google Calendar',
        description: 'Importa tus eventos reales y sincroniza lo que el Twin agenda por ti.',
        detail: 'Trae tus eventos de Google Calendar a Novo bajo demanda, y los eventos que el Twin cognitivo agenda automáticamente aparecen en tu Google Calendar real.',
        capabilities: [
          'Importa tus eventos reales de Google Calendar',
          'Los eventos que el Twin agenda por ti aparecen en tu Google Calendar real',
          'Vuelve a sincronizar cuando quieras con un clic, sin duplicar eventos',
        ],
        icon: <BrandIcon icon={SiGooglecalendar} color="#4285F4" />,
        status: (calendarStatus?.connected && calendarStatus?.hasScope) ? 'connected' : 'available',
      },
      {
        id: 'apple-calendar',
        category: 'wellness',
        name: 'Apple Calendar',
        description: 'Importa tus eventos de iCloud Calendar.',
        detail: 'Apple Calendar no usa OAuth como Google — se conecta por CalDAV con una contraseña específica de la app que generas en tu cuenta de Apple. Requiere un flujo de conexión distinto al de los demás conectores, todavía sin construir. Queda documentado como pendiente en vez de prometido en silencio.',
        icon: <BrandIcon icon={SiApple} />,
        status: 'pending',
      },
      {
        id: 'fit',
        category: 'wellness',
        name: 'Google Fit',
        description: 'Importa pasos, sueño y frecuencia cardíaca automáticamente.',
        detail: 'Trae datos de actividad, sueño y frecuencia cardíaca de Google Fit a tus trackers de salud.',
        icon: <BrandIcon icon={SiGooglefit} color="#4285F4" />,
        status: 'soon',
      },
      {
        id: 'strava',
        category: 'wellness',
        name: 'Strava',
        description: 'Importa tus entrenamientos y actividad física.',
        detail: 'Trae tus actividades de Strava (running, ciclismo, etc.) a tus trackers de salud en Novo.',
        icon: <BrandIcon icon={SiStrava} color="#FC4C02" />,
        status: 'soon',
      },
      {
        id: 'fitbit',
        category: 'wellness',
        name: 'Fitbit',
        description: 'Importa sueño, pasos y frecuencia cardíaca de tu Fitbit.',
        detail: 'Trae datos biométricos de tu dispositivo Fitbit directamente al motor cognitivo.',
        icon: <BrandIcon icon={SiFitbit} color="#00B0B9" />,
        status: 'soon',
      },
      {
        id: 'books',
        category: 'knowledge',
        name: 'Google Books',
        description: 'Busca y añade libros a tu biblioteca con datos reales.',
        detail: 'Búsqueda de libros respaldada por Google Books para agregarlos a tu biblioteca de lectura.',
        capabilities: [
          'Busca libros con datos reales de Google Books',
          'Añade resultados directamente a tu biblioteca de lectura',
        ],
        icon: <BookOpen className="w-4 h-4 text-amber-400" />,
        status: googleConnected ? 'connected' : 'available',
      },
      {
        id: 'obsidian',
        category: 'knowledge',
        name: 'Obsidian',
        description: 'Importa notas de tu vault de Obsidian.',
        detail: 'Trae notas de tu vault local de Obsidian a la biblioteca de conocimiento de Novo.',
        icon: <BrandIcon icon={SiObsidian} color="#7C3AED" />,
        status: 'soon',
      },
      {
        id: 'spotify',
        category: 'music',
        name: 'Spotify',
        description: 'Reproduce tus playlists y biblioteca de Spotify dentro de Novo.',
        detail: 'Conecta tu cuenta de Spotify para reproducir música, ver tu biblioteca y tus playlists.',
        capabilities: [
          'Reproduce tus playlists y tu biblioteca de Spotify dentro de Novo',
          'Guarda canciones que te gustan y sigue artistas',
        ],
        icon: <BrandIcon icon={SiSpotify} color="#1DB954" />,
        status: spotifyConnected ? 'connected' : 'available',
      },
      {
        id: 'youtube',
        category: 'music',
        name: 'YouTube',
        description: 'Reproduce audio de YouTube como fondo musical.',
        detail: 'Usa el mismo permiso de tu cuenta de Google (solo lectura) para reproducir audio de YouTube en el reproductor de Novo.',
        capabilities: [
          'Reproduce audio de YouTube como fondo musical en el reproductor de Novo',
          'Busca videos y accede a tus playlists de YouTube',
        ],
        icon: <BrandIcon icon={SiYoutube} color="#FF0000" />,
        status: googleConnected ? 'connected' : 'available',
      },
      {
        id: 'apple-music',
        category: 'music',
        name: 'Apple Music',
        description: 'Reproduce tu biblioteca de Apple Music dentro de Novo.',
        detail: 'Conecta tu cuenta de Apple Music para reproducir tu biblioteca y playlists.',
        icon: <BrandIcon icon={SiApplemusic} color="#FA243C" />,
        status: 'soon',
      },
      ...custom,
    ]
  }, [notionStatus, todoistStatus, slackStatus, driveStatus, calendarStatus, gmailStatus, grantStatus, customConnectors])

  const selected = connectors.find(c => c.id === selectedId) ?? null

  const handleCardClick = (connector: Connector) => {
    if (connector.status === 'soon') {
      toast({ title: 'Disponible próximamente', description: `Te avisamos cuando ${connector.name} esté listo.` })
      return
    }
    setUnreadEmails(null)
    setSelectedId(connector.id)
  }

  // ── Search — plain client-side filter by name + description, no backend ────
  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery
    ? connectors.filter(c =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.description.toLowerCase().includes(normalizedQuery),
      )
    : null

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Conectores</h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg font-medium">
            Conecta Novo con las herramientas que ya usas.
          </p>
        </div>
        <button
          onClick={() => setAddCustomOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70 flex-shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Conectar API personalizada
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar conectores, fuentes de datos..."
          className="h-11 rounded-2xl pl-11 bg-foreground/[0.02] border-foreground/10"
        />
      </div>

      {searchResults ? (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30">
            {searchResults.length} resultado{searchResults.length === 1 ? '' : 's'}
          </p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-foreground/40 py-8 text-center">Ningún conector coincide con &quot;{query}&quot;.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {searchResults.map(connector => (
                <ConnectorCard key={connector.id} connector={connector} onClick={() => handleCardClick(connector)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        CATEGORIES.map(category => {
          const items = connectors.filter(c => c.category === category.id)
          if (items.length === 0) return null
          return (
            <CategorySection key={category.id} category={category} items={items} onCardClick={handleCardClick} />
          )
        })
      )}

      <p className="text-[10px] text-foreground/20 text-center pb-2">
        Más conectores se añaden con cada versión de Novo.
      </p>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          {selected && (
            <ConnectorDetail
              connector={selected}
              notionStatus={notionStatus}
              notionLoading={notionLoading}
              notionSyncing={notionSyncing}
              notionDbs={notionDbs}
              notionDbsOpen={notionDbsOpen}
              onNotionConnect={handleNotionConnect}
              onNotionDisconnect={handleNotionDisconnect}
              onNotionSync={handleNotionSync}
              onFetchNotionDbs={handleFetchNotionDbs}
              onSaveNotionDbs={handleSaveNotionDbs}
              todoistStatus={todoistStatus}
              todoistLoading={todoistLoading}
              todoistSyncing={todoistSyncing}
              todoistProjects={todoistProjects}
              todoistProjectsOpen={todoistProjectsOpen}
              onTodoistConnect={handleTodoistConnect}
              onTodoistDisconnect={handleTodoistDisconnect}
              onTodoistSync={handleTodoistSync}
              onFetchTodoistProjects={handleFetchTodoistProjects}
              onSaveTodoistProjects={handleSaveTodoistProjects}
              slackStatus={slackStatus}
              slackLoading={slackLoading}
              slackTesting={slackTesting}
              slackChannels={slackChannels}
              slackChannelsOpen={slackChannelsOpen}
              onSlackConnect={handleSlackConnect}
              onSlackDisconnect={handleSlackDisconnect}
              onSlackTest={handleSlackTest}
              onFetchSlackChannels={handleFetchSlackChannels}
              onSaveSlackChannel={handleSaveSlackChannel}
              driveStatus={driveStatus}
              driveBackingUp={driveBackingUp}
              onDriveBackup={handleDriveBackup}
              calendarStatus={calendarStatus}
              calendarSyncing={calendarSyncing}
              onCalendarSync={handleCalendarSync}
              gmailStatus={gmailStatus}
              gmailLoading={gmailLoading}
              unreadEmails={unreadEmails}
              onGmailListUnread={handleGmailListUnread}
              onDeleteCustom={handleDeleteCustom}
            />
          )}
        </DialogContent>
      </Dialog>

      <AddCustomConnectorDialog
        open={addCustomOpen}
        onOpenChange={setAddCustomOpen}
        onSaved={() => { refreshCustomConnectors(); toast({ title: 'Guardado — activación pendiente', description: 'Novo aún no llama a este conector; queda listo para cuando lo esté.' }) }}
      />
    </div>
  )
}

// ── Detail panel — one component, switches on connector id. Every action
//    here calls the exact same handlers/routes already wired for Notion and
//    Drive; the not-yet-connected Google/Spotify ones just trigger the real
//    NextAuth signIn() flow already configured in lib/auth.ts. ────────────────
function ConnectorDetail({
  connector,
  notionStatus, notionLoading, notionSyncing, notionDbs, notionDbsOpen,
  onNotionConnect, onNotionDisconnect, onNotionSync, onFetchNotionDbs, onSaveNotionDbs,
  todoistStatus, todoistLoading, todoistSyncing, todoistProjects, todoistProjectsOpen,
  onTodoistConnect, onTodoistDisconnect, onTodoistSync, onFetchTodoistProjects, onSaveTodoistProjects,
  slackStatus, slackLoading, slackTesting, slackChannels, slackChannelsOpen,
  onSlackConnect, onSlackDisconnect, onSlackTest, onFetchSlackChannels, onSaveSlackChannel,
  driveStatus, driveBackingUp, onDriveBackup,
  calendarStatus, calendarSyncing, onCalendarSync,
  gmailStatus, gmailLoading, unreadEmails, onGmailListUnread,
  onDeleteCustom,
}: {
  connector: Connector
  notionStatus: { connected: boolean; workspaceName?: string | null; databaseIds?: string[] } | null
  notionLoading: boolean
  notionSyncing: boolean
  notionDbs: { id: string; title: string }[]
  notionDbsOpen: boolean
  onNotionConnect: () => void
  onNotionDisconnect: () => void
  onNotionSync: () => void
  onFetchNotionDbs: () => void
  onSaveNotionDbs: (ids: string[]) => void
  todoistStatus: { connected: boolean; projectIds?: string[] } | null
  todoistLoading: boolean
  todoistSyncing: boolean
  todoistProjects: { id: string; title: string }[]
  todoistProjectsOpen: boolean
  onTodoistConnect: () => void
  onTodoistDisconnect: () => void
  onTodoistSync: () => void
  onFetchTodoistProjects: () => void
  onSaveTodoistProjects: (ids: string[]) => void
  slackStatus: { connected: boolean; teamName?: string | null; channelId?: string | null; channelName?: string | null } | null
  slackLoading: boolean
  slackTesting: boolean
  slackChannels: { id: string; title: string }[]
  slackChannelsOpen: boolean
  onSlackConnect: () => void
  onSlackDisconnect: () => void
  onSlackTest: () => void
  onFetchSlackChannels: () => void
  onSaveSlackChannel: (channelId: string, channelName: string) => void
  driveStatus: { connected: boolean; hasScope: boolean } | null
  driveBackingUp: boolean
  onDriveBackup: () => void
  calendarStatus: { connected: boolean; hasScope: boolean } | null
  calendarSyncing: boolean
  onCalendarSync: () => void
  gmailStatus: { connected: boolean; hasScope: boolean } | null
  gmailLoading: boolean
  unreadEmails: { id?: string | null; subject: string; from: string; snippet?: string | null }[] | null
  onGmailListUnread: () => void
  onDeleteCustom: (provider: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-foreground/5 border border-foreground/8 flex items-center justify-center flex-shrink-0">
            {connector.icon}
          </div>
          <div>
            <DialogTitle className="text-base">{connector.name}</DialogTitle>
            <StatusPill status={connector.status} />
          </div>
        </div>
        <DialogDescription className="pt-2 text-foreground/50">{connector.detail}</DialogDescription>
      </DialogHeader>

      {connector.capabilities && connector.capabilities.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Qué puede hacer</p>
          <ul className="space-y-1.5">
            {connector.capabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/60 leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-foreground/30 mt-1.5 flex-shrink-0" />
                {cap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {connector.id === 'notion' && (
        notionStatus?.connected ? (
          <div className="flex flex-col gap-3">
            {notionStatus.workspaceName && (
              <p className="text-xs text-foreground/40">Workspace: <span className="text-foreground/70 font-medium">{notionStatus.workspaceName}</span></p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={onNotionSync}
                disabled={notionSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-all text-teal-300 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', notionSyncing && 'animate-spin')} />
                {notionSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              <button
                onClick={onNotionDisconnect}
                disabled={notionLoading}
                className="text-[11px] text-foreground/30 hover:text-red-400 transition-colors font-medium"
              >
                Desconectar
              </button>
            </div>
            <div className="pt-3 border-t border-foreground/[0.05]">
              <button
                onClick={onFetchNotionDbs}
                className="flex items-center gap-1.5 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                <Database className="w-3 h-3" />
                {notionDbsOpen ? 'Ocultar bases de datos' : `Gestionar bases de datos (${notionStatus.databaseIds?.length ?? 0} seleccionadas)`}
              </button>
              {notionDbsOpen && (
                <div className="mt-2 space-y-1.5">
                  {notionDbs.length === 0 ? (
                    <p className="text-xs text-foreground/30 italic">No se encontraron bases de datos. Asegúrate de darle acceso a Novo en Notion.</p>
                  ) : (
                    notionDbs.map(db => {
                      const isSelected = notionStatus.databaseIds?.includes(db.id) ?? false
                      return (
                        <button
                          key={db.id}
                          onClick={() => {
                            const currentIds = notionStatus.databaseIds ?? []
                            const next = isSelected ? currentIds.filter(i => i !== db.id) : [...currentIds, db.id]
                            onSaveNotionDbs(next)
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all',
                            isSelected
                              ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
                              : 'bg-foreground/[0.02] border border-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.05]',
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', isSelected ? 'bg-teal-400' : 'bg-foreground/20')} />
                          {db.title}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onNotionConnect}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            Conectar Notion
          </button>
        )
      )}

      {connector.id === 'todoist' && (
        todoistStatus?.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onTodoistSync}
                disabled={todoistSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-300 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', todoistSyncing && 'animate-spin')} />
                {todoistSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              <button
                onClick={onTodoistDisconnect}
                disabled={todoistLoading}
                className="text-[11px] text-foreground/30 hover:text-red-400 transition-colors font-medium"
              >
                Desconectar
              </button>
            </div>
            <div className="pt-3 border-t border-foreground/[0.05]">
              <button
                onClick={onFetchTodoistProjects}
                className="flex items-center gap-1.5 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                <Database className="w-3 h-3" />
                {todoistProjectsOpen ? 'Ocultar proyectos' : `Gestionar proyectos (${todoistStatus.projectIds?.length ?? 0} seleccionados)`}
              </button>
              {todoistProjectsOpen && (
                <div className="mt-2 space-y-1.5">
                  {todoistProjects.length === 0 ? (
                    <p className="text-xs text-foreground/30 italic">No se encontraron proyectos en tu cuenta de Todoist.</p>
                  ) : (
                    todoistProjects.map(project => {
                      const isSelected = todoistStatus.projectIds?.includes(project.id) ?? false
                      return (
                        <button
                          key={project.id}
                          onClick={() => {
                            const currentIds = todoistStatus.projectIds ?? []
                            const next = isSelected ? currentIds.filter(i => i !== project.id) : [...currentIds, project.id]
                            onSaveTodoistProjects(next)
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all',
                            isSelected
                              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                              : 'bg-foreground/[0.02] border border-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.05]',
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', isSelected ? 'bg-red-400' : 'bg-foreground/20')} />
                          {project.title}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onTodoistConnect}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            Conectar Todoist
          </button>
        )
      )}

      {connector.id === 'slack' && (
        slackStatus?.connected ? (
          <div className="flex flex-col gap-3">
            {slackStatus.teamName && (
              <p className="text-xs text-foreground/40">Workspace: <span className="text-foreground/70 font-medium">{slackStatus.teamName}</span></p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={onSlackTest}
                disabled={slackTesting || !slackStatus.channelId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all text-fuchsia-300 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', slackTesting && 'animate-spin')} />
                {slackTesting ? 'Enviando...' : 'Enviar mensaje de prueba'}
              </button>
              <button
                onClick={onSlackDisconnect}
                disabled={slackLoading}
                className="text-[11px] text-foreground/30 hover:text-red-400 transition-colors font-medium"
              >
                Desconectar
              </button>
            </div>
            <div className="pt-3 border-t border-foreground/[0.05]">
              <button
                onClick={onFetchSlackChannels}
                className="flex items-center gap-1.5 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                <Database className="w-3 h-3" />
                {slackChannelsOpen ? 'Ocultar canales' : `Elegir canal ${slackStatus.channelName ? `(${slackStatus.channelName})` : '(ninguno seleccionado)'}`}
              </button>
              {slackChannelsOpen && (
                <div className="mt-2 space-y-1.5">
                  {slackChannels.length === 0 ? (
                    <p className="text-xs text-foreground/30 italic">No se encontraron canales. Invita al bot de Novo al canal deseado en Slack.</p>
                  ) : (
                    slackChannels.map(channel => {
                      const isSelected = slackStatus.channelId === channel.id
                      return (
                        <button
                          key={channel.id}
                          onClick={() => onSaveSlackChannel(channel.id, channel.title)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all',
                            isSelected
                              ? 'bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300'
                              : 'bg-foreground/[0.02] border border-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.05]',
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', isSelected ? 'bg-fuchsia-400' : 'bg-foreground/20')} />
                          {channel.title}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onSlackConnect}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            Conectar Slack
          </button>
        )
      )}

      {connector.id === 'drive' && (
        driveStatus?.connected && driveStatus?.hasScope ? (
          <button
            onClick={onDriveBackup}
            disabled={driveBackingUp}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-blue-300 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {driveBackingUp ? 'Guardando...' : 'Respaldar ahora'}
          </button>
        ) : (
          <button
            onClick={() => signIn('google', undefined, { scope: 'openid profile email https://www.googleapis.com/auth/drive.file' })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            {driveStatus?.connected ? 'Otorgar acceso a Drive' : 'Conectar Google'}
          </button>
        )
      )}

      {connector.id === 'calendar' && (
        calendarStatus?.connected && calendarStatus?.hasScope ? (
          <button
            onClick={onCalendarSync}
            disabled={calendarSyncing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-blue-300 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', calendarSyncing && 'animate-spin')} />
            {calendarSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        ) : (
          <button
            onClick={() => signIn('google', undefined, { scope: 'openid profile email https://www.googleapis.com/auth/calendar' })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            {calendarStatus?.connected ? 'Otorgar acceso a Calendar' : 'Conectar Google'}
          </button>
        )
      )}

      {connector.id === 'gmail' && (
        gmailStatus?.connected && gmailStatus?.hasScope ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onGmailListUnread}
              disabled={gmailLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-300 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', gmailLoading && 'animate-spin')} />
              {gmailLoading ? 'Cargando...' : 'Ver no leídos'}
            </button>
            {unreadEmails && (
              unreadEmails.length === 0 ? (
                <p className="text-xs text-foreground/35 text-center py-2">No tienes correos sin leer.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {unreadEmails.map((email, i) => (
                    <div key={email.id ?? i} className="px-3 py-2 rounded-xl bg-foreground/[0.02] border border-foreground/[0.06]">
                      <p className="text-xs font-semibold text-foreground/80 truncate">{email.subject}</p>
                      <p className="text-[11px] text-foreground/40 truncate mt-0.5">{email.from}</p>
                      {email.snippet && (
                        <p className="text-[11px] text-foreground/35 mt-1 leading-relaxed line-clamp-2">{email.snippet}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <button
            onClick={() => signIn('google', undefined, { scope: 'openid profile email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly' })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            {gmailStatus?.connected ? 'Otorgar acceso a Gmail' : 'Conectar Google'}
          </button>
        )
      )}

      {(connector.id === 'contacts' || connector.id === 'books' || connector.id === 'youtube') && (
        connector.status === 'connected' ? (
          <a
            href={connector.id === 'contacts' ? '/business' : connector.id === 'books' ? '/library' : '/music'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            Ir al módulo
          </a>
        ) : (
          <button
            onClick={() => signIn('google', undefined, { scope: 'openid profile email https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/books https://www.googleapis.com/auth/youtube.readonly' })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            Conectar Google
          </button>
        )
      )}

      {connector.id === 'spotify' && (
        connector.status === 'connected' ? (
          <a
            href="/music"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            Ir a Música
          </a>
        ) : (
          <button
            onClick={() => signIn('spotify')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70"
          >
            <Link2 className="w-4 h-4" />
            Conectar Spotify
          </button>
        )
      )}

      {connector.category === 'custom' && (
        <div className="flex flex-col gap-3">
          {connector.baseUrl && (
            <p className="text-xs text-foreground/40 break-all">URL: <span className="text-foreground/70 font-medium">{connector.baseUrl}</span></p>
          )}
          <p className="text-xs text-foreground/35 leading-relaxed">
            Guardado en Novo. Todavía no hay lógica que llame a esta API — es un registro listo para cuando se active.
          </p>
          <button
            onClick={() => onDeleteCustom(connector.id)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ── "Conectar API personalizada" — saves a name/baseUrl/apiKey record via
//    /api/integration/custom. Nothing calls it yet; honestly presented as
//    "pending activation" rather than pretending to be a live connection. ────
function AddCustomConnectorDialog({
  open, onOpenChange, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const reset = () => { setName(''); setBaseUrl(''); setApiKey('') }

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/integration/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, baseUrl, apiKey }),
      })
      if (!res.ok) throw new Error('save failed')
      reset()
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ title: 'No se pudo guardar la conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Conectar API personalizada</DialogTitle>
          <DialogDescription className="text-foreground/50">
            Guarda las credenciales de cualquier API. Por ahora esto solo se guarda como registro — Novo todavía no ejecuta llamadas contra ella.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Nombre</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mi API interna" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">URL base</label>
            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.ejemplo.com" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">API key (opcional)</label>
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="sk-..." className="rounded-xl" />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !baseUrl.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20 transition-all text-foreground/70 disabled:opacity-40 mt-1"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
