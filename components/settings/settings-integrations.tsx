'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Upload, Database, Link2 } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { useSession, signOut, signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Section } from './settings-shared'

export function SettingsIntegrations() {
  const { toast } = useToast()
  const { settings } = useSettings()
  const { data: session } = useSession()

  // ── Notion integration state ────────────────────────────────────────────────
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

  // ── Google Drive state ──────────────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; hasScope: boolean } | null>(null)
  const [driveBackingUp, setDriveBackingUp] = useState(false)

  // Handle ?notionStatus= query param from OAuth callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ns = params.get('notionStatus')
    if (ns === 'connected') {
      toast({ title: 'Notion connected', description: 'Your workspace is now linked to Novo.' })
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      window.history.replaceState({}, '', url.toString())
    } else if (ns === 'error') {
      const reason = params.get('reason') ?? 'unknown'
      toast({ title: 'Notion connection failed', description: `Reason: ${reason}`, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('notionStatus')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Fetch Notion + Drive status on mount
  useEffect(() => {
    if (!session?.user?.id) return

    // Notion
    fetch('/api/integration/notion')
      .then(r => r.json())
      .then(data => setNotionStatus(data))
      .catch(() => setNotionStatus({ connected: false }))

    // Drive
    fetch('/api/integration/drive')
      .then(r => r.json())
      .then(data => setDriveStatus(data))
      .catch(() => setDriveStatus({ connected: false, hasScope: false }))
  }, [session?.user?.id])

  // ── Notion helpers ──────────────────────────────────────────────────────────
  const handleNotionConnect = () => {
    window.location.href = '/api/integration/notion/connect'
  }

  const handleNotionDisconnect = async () => {
    setNotionLoading(true)
    try {
      await fetch('/api/integration/notion', { method: 'DELETE' })
      setNotionStatus({ connected: false })
      toast({ title: 'Notion disconnected' })
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' })
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
      toast({ title: `Synced ${data.total} tasks from Notion`, description: `${data.created} created, ${data.updated} updated` })
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' })
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
      toast({ title: 'Could not fetch databases', variant: 'destructive' })
    }
  }

  const handleSaveNotionDbs = async (ids: string[]) => {
    await fetch('/api/integration/notion?action=save_databases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseIds: ids }),
    })
    setNotionStatus(prev => prev ? { ...prev, databaseIds: ids } : prev)
    toast({ title: 'Databases saved' })
  }

  // ── Drive helpers ───────────────────────────────────────────────────────────
  const handleDriveBackup = async () => {
    setDriveBackingUp(true)
    try {
      const localSettings = settings
      const res = await fetch('/api/integration/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: localSettings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Backup failed')
      toast({
        title: 'Backup saved to Drive',
        description: data.fileName,
      })
    } catch (err: any) {
      toast({ title: 'Drive backup failed', description: err.message, variant: 'destructive' })
    } finally {
      setDriveBackingUp(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <p className="text-xs text-white/35">
        Connect external services to sync your data with Novo. All connections use secure OAuth — no passwords are stored.
      </p>

      {/* Google */}
      <Section title="Google Workspace">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85">Google Account</p>
                  <p className="text-xs text-white/35">
                    {session?.user?.email
                      ? `Connected as ${session.user.email}`
                      : 'Sync Calendar, Drive, and Contacts'}
                  </p>
                </div>
              </div>
              {session?.user ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Connect
                </button>
              )}
            </div>
          </div>

          {/* Google Drive row -- live backup */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M7.71 3.5L1.15 15l3.43 5.96L10.14 9.46 7.71 3.5z" fill="#0066DA"/>
                    <path d="M16.29 3.5L13.86 9.46l5.56 11.5H25L21.57 15 16.29 3.5z" fill="#00AC47"/>
                    <path d="M10.14 9.46L4.58 20.96h14.84l-3.56-11.5H10.14z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85">Google Drive</p>
                  <p className="text-xs text-white/35">
                    {driveStatus?.connected && driveStatus?.hasScope
                      ? 'Backup your workspace data to Google Drive'
                      : driveStatus?.connected && !driveStatus?.hasScope
                        ? 'Drive scope not granted -- reconnect Google'
                        : 'Connect Google first to enable Drive backup'}
                  </p>
                </div>
              </div>
              {driveStatus?.connected && driveStatus?.hasScope ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </span>
                  <button
                    onClick={handleDriveBackup}
                    disabled={driveBackingUp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-blue-300 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {driveBackingUp ? 'Saving...' : 'Backup Now'}
                  </button>
                </div>
              ) : driveStatus?.connected ? (
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Grant Access
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 text-white/30 border border-white/8">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  Not Connected
                </span>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Notion -- live OAuth integration */}
      <Section title="Productivity">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/60 font-bold text-sm">
                  N
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85">Notion</p>
                  <p className="text-xs text-white/35">
                    {notionStatus?.connected
                      ? `Workspace: ${notionStatus.workspaceName ?? 'Connected'}`
                      : 'Import tasks and databases from Notion'}
                  </p>
                </div>
              </div>
              {notionStatus?.connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                  <button
                    onClick={handleNotionSync}
                    disabled={notionSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-all text-teal-300 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', notionSyncing && 'animate-spin')} />
                    {notionSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleNotionDisconnect}
                    disabled={notionLoading}
                    className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleNotionConnect}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/70"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Connect
                </button>
              )}
            </div>

            {/* Database selector -- shown when connected */}
            {notionStatus?.connected && (
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <button
                  onClick={handleFetchNotionDbs}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
                >
                  <Database className="w-3 h-3" />
                  {notionDbsOpen ? 'Hide databases' : `Manage databases (${notionStatus.databaseIds?.length ?? 0} selected)`}
                </button>

                {notionDbsOpen && (
                  <div className="mt-2 space-y-1.5">
                    {notionDbs.length === 0 ? (
                      <p className="text-xs text-white/30 italic">No databases found. Make sure Novo has access to your Notion pages.</p>
                    ) : (
                      notionDbs.map(db => {
                        const selected = notionStatus.databaseIds?.includes(db.id) ?? false
                        return (
                          <button
                            key={db.id}
                            onClick={() => {
                              const currentIds = notionStatus.databaseIds ?? []
                              const next = selected
                                ? currentIds.filter(i => i !== db.id)
                                : [...currentIds, db.id]
                              handleSaveNotionDbs(next)
                            }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all',
                              selected
                                ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
                                : 'bg-white/[0.02] border border-white/[0.06] text-white/50 hover:bg-white/[0.05]'
                            )}
                          >
                            <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', selected ? 'bg-teal-400' : 'bg-white/20')} />
                            {db.title}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#36C5F0">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85">Slack</p>
                  <p className="text-xs text-white/35">Receive cognitive alerts in your Slack workspace</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 text-white/30 border border-white/8">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </Section>

      <p className="text-[10px] text-white/20 text-center pb-2">
        More integrations are added with each Novo release.
      </p>
    </div>
  )
}
