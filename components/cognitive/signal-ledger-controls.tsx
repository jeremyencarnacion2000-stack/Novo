'use client'

import { useEffect, useState } from 'react'
import { EyeOff, FilePenLine, RotateCcw } from 'lucide-react'

type Signal = {
  id: string
  source: string
  label: string
  reliability: string
  excludedAt: string | null
  correction: string | null
}
type SourcePreference = { source: string; excludedAt: string | null }

const reliabilityCopy: Record<string, { es: string; en: string }> = {
  user_reported: { es: 'Declarado por ti', en: 'Reported by you' },
  direct: { es: 'Dato observado', en: 'Observed data' },
  deterministic: { es: 'Estimación determinista', en: 'Deterministic estimate' },
  inference: { es: 'Inferencia de Novo', en: 'Novo inference' },
}

export function SignalLedgerControls({ language, onChanged }: { language: 'es' | 'en'; onChanged?: () => void }) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [preferences, setPreferences] = useState<SourcePreference[]>([])
  const [expanded, setExpanded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [correctionId, setCorrectionId] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')

  const refresh = async () => {
    const response = await fetch('/api/cognitive/loop/signals')
    if (!response.ok) return
    const data = await response.json()
    setSignals(data.signals ?? [])
    setPreferences(data.sourcePreferences ?? [])
  }
  useEffect(() => { void refresh() }, [])

  const mutate = async (body: Record<string, unknown>, key: string) => {
    setBusyId(key)
    try {
      const response = await fetch('/api/cognitive/loop/signals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) return
      await refresh()
      onChanged?.()
    } finally { setBusyId(null) }
  }
  const sourceExcluded = (source: string) => preferences.some((item) => item.source === source && item.excludedAt)
  const c = language === 'es' ? {
    title: 'Fuentes usadas', show: 'Revisar y corregir', hide: 'Ocultar detalles', empty: 'Aún no hay señales auditables para esta recomendación.',
    exclude: 'Excluir esta señal', restore: 'Restaurar señal', excludeSource: 'Ignorar esta fuente', restoreSource: 'Usar esta fuente', correct: 'Corregir', save: 'Guardar corrección', placeholder: 'Describe el dato correcto',
  } : {
    title: 'Sources used', show: 'Review and correct', hide: 'Hide details', empty: 'There are no auditable signals for this recommendation yet.',
    exclude: 'Exclude this signal', restore: 'Restore signal', excludeSource: 'Ignore this source', restoreSource: 'Use this source', correct: 'Correct', save: 'Save correction', placeholder: 'Describe the correct fact',
  }

  return <section className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{c.title}</p><p className="mt-1 text-xs text-foreground/60">{language === 'es' ? 'Puedes corregir o excluir datos sin borrar su procedencia.' : 'You can correct or exclude data without deleting its provenance.'}</p></div><button type="button" onClick={() => setExpanded((value) => !value)} className="rounded-full border border-foreground/10 px-3 py-2 text-xs font-semibold text-foreground/75">{expanded ? c.hide : c.show}</button></div>
    {expanded && <div className="mt-4 space-y-3">{signals.length === 0 ? <p className="text-xs text-muted-foreground">{c.empty}</p> : signals.map((signal) => <article key={signal.id} className="rounded-xl border border-foreground/[0.08] bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-foreground/85">{signal.correction || signal.label}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{reliabilityCopy[signal.reliability]?.[language] ?? signal.reliability} · {signal.source}</p>{signal.excludedAt && <p className="mt-1 text-[10px] font-semibold text-amber-500">{language === 'es' ? 'Excluida del próximo plan' : 'Excluded from the next plan'}</p>}</div><div className="flex shrink-0 gap-1"><button aria-label={signal.excludedAt ? c.restore : c.exclude} disabled={busyId === signal.id} onClick={() => void mutate({ signalId: signal.id, action: signal.excludedAt ? 'restore' : 'exclude' }, signal.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><EyeOff className="size-3.5" /></button><button aria-label={c.correct} onClick={() => { setCorrectionId(signal.id); setCorrection(signal.correction ?? signal.label) }} className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><FilePenLine className="size-3.5" /></button></div></div>{correctionId === signal.id && <form onSubmit={(event) => { event.preventDefault(); if (correction.trim()) void mutate({ signalId: signal.id, action: 'correct', correction: correction.trim() }, signal.id) }} className="mt-3 flex gap-2"><input value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder={c.placeholder} className="min-w-0 flex-1 rounded-lg border border-foreground/10 bg-background/60 px-3 py-2 text-xs text-foreground" /><button className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{c.save}</button></form>}<button disabled={busyId === `source-${signal.source}`} onClick={() => void mutate({ action: sourceExcluded(signal.source) ? 'restore_source' : 'exclude_source', source: signal.source }, `source-${signal.source}`)} className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" />{sourceExcluded(signal.source) ? c.restoreSource : c.excludeSource}</button></article>)}</div>}
  </section>
}
