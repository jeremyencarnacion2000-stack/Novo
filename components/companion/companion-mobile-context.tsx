'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, Clock3, LaptopMinimal, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'
import { DeveloperContextPanel } from '@/components/companion/developer-context-panel'

type Signal = {
  sourceRef: string
  signalType: string
  label: string
  observedAt: string
  reliability: string
}

type ActivityPayload = { sourceExcluded: boolean; signals: Signal[] }

const COPY = {
  es: {
    eyebrow: 'Compañero de Novo', title: 'Tu contexto, también aquí', description: 'Consulta los resúmenes que el compañero de escritorio compartió con tu Twin. Esta vista no necesita que Windows siga conectado.',
    loading: 'Cargando contexto…', summary: 'Resumen agregado', privacy: 'Solo se sincronizan el nombre normalizado de la aplicación y el tiempo de uso. No se muestran títulos, texto, rutas ni historial detallado de ventanas.',
    excluded: 'Excluiste esta fuente. No se mostrará ni se usará para el contexto del Twin.', empty: 'Todavía no hay resúmenes sincronizados desde tus dispositivos.', error: 'No se pudo cargar el contexto ahora. Los detalles técnicos y credenciales se ocultan por seguridad.', retry: 'Intentar de nuevo',
    sources: 'Fuentes de trabajo', github: 'GitHub', vercel: 'Vercel', sourceDetail: 'Conecta y elige tus fuentes en Conexiones. El compañero solo consulta las conexiones autorizadas; no aprueba comandos, fusiona cambios ni vuelve a desplegar.',
    connections: 'Administrar conexiones', twin: 'Abrir contexto de Novo', reliability: 'Señal observada',
  },
  en: {
    eyebrow: 'Novo Companion', title: 'Your context, here too', description: 'Review summaries your desktop companion shared with your Twin. Windows does not need to stay connected for this view.',
    loading: 'Loading context…', summary: 'Aggregated summary', privacy: 'Only normalized app names and usage duration are synced. Window titles, text, paths, and detailed window history are never shown.',
    excluded: 'You excluded this source. It will not be shown or used in Twin context.', empty: 'No summaries have synced from your devices yet.', error: 'Context could not be loaded. Technical details and credentials are hidden for safety.', retry: 'Try again',
    sources: 'Work sources', github: 'GitHub', vercel: 'Vercel', sourceDetail: 'Connect and choose sources in Connections. The companion only reads authorised connections; it does not approve commands, merge changes, or redeploy.',
    connections: 'Manage connections', twin: 'Open Novo context', reliability: 'Observed signal',
  },
  fr: {
    eyebrow: 'Compagnon Novo', title: 'Votre contexte, aussi ici', description: 'Consultez les résumés partagés avec votre Twin par le compagnon de bureau. Windows n’a pas besoin de rester connecté.',
    loading: 'Chargement du contexte…', summary: 'Résumé agrégé', privacy: 'Seuls les noms normalisés des applications et leur durée sont synchronisés. Aucun titre, texte, chemin ou historique détaillé n’est affiché.',
    excluded: 'Vous avez exclu cette source. Elle ne sera ni affichée ni utilisée dans le contexte du Twin.', empty: 'Aucun résumé de vos appareils n’a encore été synchronisé.', error: 'Le contexte est momentanément indisponible. Les détails techniques et identifiants restent masqués.', retry: 'Réessayer',
    sources: 'Sources de travail', github: 'GitHub', vercel: 'Vercel', sourceDetail: 'Connectez et choisissez vos sources dans Connexions. Le compagnon consulte uniquement les connexions autorisées.',
    connections: 'Gérer les connexions', twin: 'Ouvrir le contexte Novo', reliability: 'Signal observé',
  },
  de: {
    eyebrow: 'Novo Companion', title: 'Dein Kontext, auch hier', description: 'Sieh dir Zusammenfassungen an, die der Desktop-Begleiter mit deinem Twin geteilt hat. Windows muss dafür nicht verbunden bleiben.',
    loading: 'Kontext wird geladen…', summary: 'Aggregierte Zusammenfassung', privacy: 'Synchronisiert werden nur normalisierte App-Namen und Nutzungsdauer. Fenstertitel, Text, Pfade und detaillierter Fensterverlauf werden nie angezeigt.',
    excluded: 'Du hast diese Quelle ausgeschlossen. Sie wird weder angezeigt noch für den Twin-Kontext verwendet.', empty: 'Von deinen Geräten wurden noch keine Zusammenfassungen synchronisiert.', error: 'Der Kontext konnte nicht geladen werden. Technische Details und Zugangsdaten bleiben verborgen.', retry: 'Erneut versuchen',
    sources: 'Arbeitsquellen', github: 'GitHub', vercel: 'Vercel', sourceDetail: 'Verbinde und wähle Quellen unter Verbindungen. Der Begleiter liest nur autorisierte Verbindungen.',
    connections: 'Verbindungen verwalten', twin: 'Novo-Kontext öffnen', reliability: 'Beobachtetes Signal',
  },
} as const

export function CompanionMobileContext() {
  const { language } = useTranslation()
  const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const copy = COPY[locale]
  const [payload, setPayload] = useState<ActivityPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const loadActivity = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setHasError(false)
    try {
      const response = await fetch('/api/companion/activity', { cache: 'no-store', signal })
      if (!response.ok) throw new Error('request_failed')
      const result = await response.json() as ActivityPayload
      if (!Array.isArray(result.signals) || typeof result.sourceExcluded !== 'boolean') throw new Error('invalid_response')
      setPayload(result)
    } catch {
      if (!signal?.aborted) setHasError(true)
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadActivity(controller.signal)
    return () => controller.abort()
  }, [loadActivity])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-8 md:px-8 md:py-12">
      <header className="mb-7 rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/[0.11] via-foreground/[0.025] to-transparent p-6 md:p-8">
        <div className="flex items-center gap-3 text-primary"><div className="grid size-10 place-items-center rounded-2xl border border-primary/20 bg-primary/10"><Sparkles className="size-5" /></div><p className="text-[10px] font-bold uppercase tracking-[0.24em]">{copy.eyebrow}</p></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">{copy.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/cognitive" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"><Sparkles className="size-4" />{copy.twin}</Link>
          <Link href="/connectors" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.035] px-4 text-sm font-medium text-foreground/75 transition hover:bg-foreground/[0.07]"><ArrowUpRight className="size-4" />{copy.connections}</Link>
        </div>
      </header>

      <section aria-labelledby="companion-activity-title" className="rounded-[26px] border border-foreground/[0.08] bg-foreground/[0.025] p-5 md:p-7">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-foreground/[0.055] text-primary"><LaptopMinimal className="size-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">{copy.summary}</p><h2 id="companion-activity-title" className="mt-1 text-lg font-semibold text-foreground">{copy.eyebrow}</h2></div></div>
        <div className="mt-5 rounded-2xl border border-foreground/[0.06] bg-background/25 p-4">
          {isLoading ? <p role="status" className="text-sm text-foreground/50">{copy.loading}</p> : hasError ? <div className="flex items-start gap-3" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" /><div><p className="text-sm text-foreground/65">{copy.error}</p><button type="button" onClick={() => void loadActivity()} className="mt-3 min-h-10 rounded-full border border-foreground/10 px-4 text-xs font-semibold text-foreground/75 hover:bg-foreground/[0.05]">{copy.retry}</button></div></div> : payload?.sourceExcluded ? <p className="text-sm leading-6 text-foreground/55">{copy.excluded}</p> : payload?.signals.length ? <ol className="divide-y divide-foreground/[0.06]">{payload.signals.map((signal) => <li key={`${signal.sourceRef}:${signal.observedAt}`} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium leading-6 text-foreground/80">{signal.label}</p><span title={copy.reliability} className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/[0.08] px-2 py-1 text-[10px] font-medium text-primary/80"><ShieldCheck className="size-3" />{copy.reliability}</span></div><p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/40"><Clock3 className="size-3" />{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(signal.observedAt))}</p></li>)}</ol> : <p className="text-sm leading-6 text-foreground/50">{copy.empty}</p>}
        </div>
        {!payload?.sourceExcluded && <p className="mt-4 text-xs leading-5 text-foreground/40">{copy.privacy}</p>}
      </section>

      <DeveloperContextPanel />
    </main>
  )
}
