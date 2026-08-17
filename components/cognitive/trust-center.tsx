'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Cloud, Database, ExternalLink, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react'
import { LiquidSwitch } from '@/components/ui/liquid-switch'
import { SignalLedgerControls } from '@/components/cognitive/signal-ledger-controls'
import { Section } from '@/components/settings/settings-shared'

type Signal = { source: string; excludedAt: string | null }
type IntegrationStatus = { google?: boolean; spotify?: boolean }

export function TrustCenter({ language }: { language: 'es' | 'en' }) {
  const [paused, setPaused] = useState(false)
  const [signals, setSignals] = useState<Signal[]>([])
  const [integrations, setIntegrations] = useState<IntegrationStatus>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = language === 'es'
    ? { title: 'Centro de confianza', intro: 'Revisa qué usa Novo para aprender, qué permisos están activos y cómo cambiar el modelo.', sources: 'Fuentes de señales', permissions: 'Permisos de conexión', local: 'Señales operativas', cloud: 'Conexiones externas', localTag: 'Local', cloudTag: 'Cloud', active: 'Activa', excluded: 'Excluida', connected: 'Conectada', notConnected: 'No conectada', pause: 'Pausar aprendizaje', resume: 'Reanudar aprendizaje', pauseDesc: 'Mientras esté pausado, las nuevas señales de comportamiento no actualizarán tu Gemelo.', saved: 'Preferencia guardada.', failed: 'No se pudo guardar. Inténtalo de nuevo.', advanced: 'Exportar o eliminar datos', integrations: 'Revisar integraciones' }
    : { title: 'Trust center', intro: 'Review what Novo uses to learn, which permissions are active, and how to change the model.', sources: 'Signal sources', permissions: 'Connection permissions', local: 'Operational signals', cloud: 'External connections', localTag: 'Local', cloudTag: 'Cloud', active: 'Active', excluded: 'Excluded', connected: 'Connected', notConnected: 'Not connected', pause: 'Pause learning', resume: 'Resume learning', pauseDesc: 'While paused, new behavioral signals will not update your Twin.', saved: 'Preference saved.', failed: 'Could not save this preference. Try again.', advanced: 'Export or delete data', integrations: 'Review integrations' }

  const refresh = async () => {
    const [preferenceResponse, signalsResponse, integrationsResponse] = await Promise.all([
      fetch('/api/cognitive/learning-preference'),
      fetch('/api/cognitive/loop/signals'),
      fetch('/api/integration/status'),
    ])
    if (preferenceResponse.ok) setPaused(Boolean((await preferenceResponse.json()).paused))
    if (signalsResponse.ok) setSignals((await signalsResponse.json()).signals ?? [])
    if (integrationsResponse.ok) setIntegrations(await integrationsResponse.json())
  }

  useEffect(() => { void refresh() }, [])

  const sources = useMemo(() => Array.from(new Set(signals.map((signal) => signal.source))), [signals])
  const cloudSources = useMemo(() => new Set(['calendar']), [])
  const connectedCount = Object.values(integrations).filter(Boolean).length

  const updatePaused = async (nextPaused: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/cognitive/learning-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: nextPaused }) })
      if (!response.ok) throw new Error('preference')
      setPaused(nextPaused)
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-5 rounded-[26px] border border-primary/15 bg-primary/[0.035] p-5 sm:p-6" aria-labelledby="trust-center-title">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2.5 text-primary"><ShieldCheck className="size-5" /></div>
      <div><h2 id="trust-center-title" className="text-lg font-semibold text-foreground">{copy.title}</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/58">{copy.intro}</p></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-2xl border border-foreground/10 bg-background/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-foreground/80"><Database className="size-4 text-primary" />{copy.sources}</div><p className="mt-2 text-[11px] text-foreground/52">{signals.length} señales auditables · {sources.length} fuentes</p><div className="mt-3 flex flex-wrap gap-2">{sources.length ? sources.map((source) => { const isCloud = cloudSources.has(source); return <span key={source} className="rounded-full border border-foreground/10 px-2.5 py-1 text-[10px] text-foreground/65">{source} · {isCloud ? copy.cloudTag : copy.localTag} · {copy.active}</span> }) : <span className="text-[11px] text-foreground/45">{copy.local}: 0</span>}</div></article>
      <article className="rounded-2xl border border-foreground/10 bg-background/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-foreground/80"><Cloud className="size-4 text-primary" />{copy.permissions}</div><p className="mt-2 text-[11px] text-foreground/52">{connectedCount} conexiones con permiso de lectura disponible</p><div className="mt-3 flex flex-wrap gap-2">{(['google', 'spotify'] as const).map((provider) => <span key={provider} className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-2.5 py-1 text-[10px] text-foreground/65">{integrations[provider] ? <CheckCircle2 className="size-3 text-emerald-400" /> : <span className="size-1.5 rounded-full bg-foreground/25" />}{provider} · {integrations[provider] ? copy.connected : copy.notConnected}</span>)}</div></article>
    </div>

    <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4"><div className="flex items-center justify-between gap-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-foreground/[0.06] p-2 text-foreground/65">{paused ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}</div><div><p className="text-sm font-semibold text-foreground/80">{paused ? copy.resume : copy.pause}</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-foreground/48">{copy.pauseDesc}</p></div></div><LiquidSwitch aria-label={paused ? copy.resume : copy.pause} checked={!paused} disabled={busy} onCheckedChange={(checked) => void updatePaused(!checked)} /></div>{error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}</div>

    <SignalLedgerControls language={language} onChanged={() => void refresh()} />
    <div className="flex flex-wrap gap-2 border-t border-foreground/10 pt-4"><Link href="/settings?tab=advanced" className="inline-flex items-center gap-1.5 rounded-xl border border-foreground/10 px-3 py-2 text-xs font-semibold text-foreground/65 hover:bg-foreground/[0.05]">{copy.advanced} <ExternalLink className="size-3" /></Link><Link href="/settings?tab=integrations" className="inline-flex items-center gap-1.5 rounded-xl border border-foreground/10 px-3 py-2 text-xs font-semibold text-foreground/65 hover:bg-foreground/[0.05]">{copy.integrations} <ExternalLink className="size-3" /></Link></div>
  </section>
}
