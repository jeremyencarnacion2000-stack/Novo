'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, Check, ChevronRight, CircleAlert, Loader2, Play, Sparkles, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { NovoActivitySurface } from '@/components/ai/novo-activity-surface'
import { SignalLedgerControls } from '@/components/cognitive/signal-ledger-controls'

type Action = { id: string; title: string; nextStep: string; explanation: string; confidence: number; estimatedMinutes?: number; status: string; facts: string[]; inferences: string[] }
type Plan = { id: string; actions: Action[] }
type ActionResponse = 'accepted' | 'modified' | 'started' | 'postponed' | 'dismissed' | 'completed' | 'abandoned' | 'failed' | 'helpful' | 'unhelpful' | 'intrusive'
type OutcomeReason = 'lack_of_time' | 'too_large' | 'external_dependency' | 'priority_changed' | 'incorrect_recommendation' | 'insufficient_information' | 'technical_problem' | 'other'

const copy = {
  en: { eyebrow: 'Operating loop', title: 'What matters now', intro: 'Novo uses your objective and current state to propose one executable next step.', objective: 'Important objective', objectivePlaceholder: 'What outcome matters most right now?', context: 'Current context', contextPlaceholder: 'What is shaping your attention today?', energy: 'Energy', focus: 'Focus', workload: 'Workload', minutes: 'Available minutes', continue: 'Generate my next step', facts: 'Observed facts', inference: 'Novo estimates', why: 'Why this recommendation', accept: 'Accept', modify: 'Modify', postpone: 'Later', dismiss: 'Dismiss', complete: 'Mark complete', calendar: 'Schedule focus', helpful: 'Useful', notHelpful: 'Not useful', accepted: 'Action accepted', error: 'We could not save this step. Try again.' },
  es: { eyebrow: 'Ciclo operativo', title: 'Qué importa ahora', intro: 'Novo usa tu objetivo y tu estado actual para proponer un siguiente paso ejecutable.', objective: 'Objetivo importante', objectivePlaceholder: '¿Qué resultado importa más ahora?', context: 'Contexto actual', contextPlaceholder: '¿Qué influye en tu atención hoy?', energy: 'Energía', focus: 'Enfoque', workload: 'Carga', minutes: 'Minutos disponibles', continue: 'Generar mi siguiente paso', facts: 'Hechos observados', inference: 'Estimación de Novo', why: 'Por qué aparece esta recomendación', accept: 'Aceptar', modify: 'Modificar', postpone: 'Después', dismiss: 'Descartar', complete: 'Marcar completa', calendar: 'Programar enfoque', helpful: 'Útil', notHelpful: 'No fue útil', accepted: 'Acción aceptada', error: 'No pudimos guardar este paso. Inténtalo de nuevo.' },
} as const

function confidencePresentation(value: number, language: string) {
  const level = value >= 0.75 ? 'high' : value >= 0.45 ? 'medium' : 'low'
  const spanish = language === 'es'
  return {
    level,
    label: spanish
      ? (level === 'high' ? 'Alta' : level === 'medium' ? 'Media' : 'Baja')
      : (level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'),
    detail: spanish
      ? (level === 'high' ? 'Señales suficientes y coherentes.' : level === 'medium' ? 'Hay señales útiles, pero el contexto puede cambiar.' : 'Faltan señales o el contexto es limitado.')
      : (level === 'high' ? 'The available signals are sufficient and consistent.' : level === 'medium' ? 'Useful signals exist, but context can change.' : 'Signals are missing or the context is limited.'),
  }
}

export function NovoLoopCard() {
  const { language } = useTranslation()
  const text = copy[language === 'es' ? 'es' : 'en']
  const [plan, setPlan] = useState<Plan | null>(null)
  const [objective, setObjective] = useState('')
  const [context, setContext] = useState('')
  const [energy, setEnergy] = useState(3)
  const [focus, setFocus] = useState(3)
  const [workload, setWorkload] = useState(3)
  const [minutes, setMinutes] = useState(45)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [responseNote, setResponseNote] = useState('')
  const [modifiedNextStep, setModifiedNextStep] = useState('')
  const [editingRecommendation, setEditingRecommendation] = useState(false)
  const [outcomeReason, setOutcomeReason] = useState<OutcomeReason | ''>('')
  const [staleActionIds, setStaleActionIds] = useState<string[]>([])
  const [activityRunId, setActivityRunId] = useState<string | null>(null)
  const [calendarConfirmationOpen, setCalendarConfirmationOpen] = useState(false)
  const action = plan?.actions?.[0]
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/cognitive/loop/plan').then((response) => response.ok ? response.json() : null),
      fetch('/api/ai/activity/runs', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
    ]).then(([data, activity]) => {
      if (cancelled) return
      setPlan(data?.plan ?? null)
      setStaleActionIds(data?.staleActions ?? [])
      if (activity?.run?.id) setActivityRunId(activity.run.id)
    }).catch(() => undefined).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [])

  async function generatePlan() {
    setBusy(true); setError('')
    try {
      let goalId: string | undefined
      const runResponse = await fetch('/api/ai/activity/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surface: 'novo_loop' }) })
      if (!runResponse.ok) throw new Error()
      const createdRun = await runResponse.json()
      setActivityRunId(createdRun.runId)
      if (objective.trim()) {
        const goal = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: objective.trim(), status: 'active', source: 'today' }) })
        if (!goal.ok) throw new Error()
        const createdGoal = await goal.json()
        if (typeof createdGoal?.id !== 'string') throw new Error()
        goalId = createdGoal.id
      }
      const checkin = await fetch('/api/cognitive/loop/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ energy, focus, workload, availableMinutes: minutes, currentContext: context.trim() || 'Planificación del día', timezone }) })
      if (!checkin.ok) throw new Error()
      const snapshot = await checkin.json()
      const generated = await fetch('/api/cognitive/loop/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshotId: snapshot.snapshot.id, timezone, runId: createdRun.runId, ...(goalId ? { goalId } : {}) }) })
      if (!generated.ok) throw new Error()
      setPlan((await generated.json()).plan)
    } catch { setError(text.error) } finally { setBusy(false) }
  }

  async function cancelRun() {
    if (!activityRunId) return
    await fetch(`/api/ai/activity/runs/${activityRunId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) }).catch(() => undefined)
    setBusy(false)
  }

  async function respond(response: ActionResponse) {
    if (!action) return
    setBusy(true); setError('')
    try {
      const result = await fetch('/api/cognitive/loop/response', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId: action.id, response, reason: outcomeReason || undefined, note: responseNote.trim() || undefined, ...(response === 'modified' ? { modifiedNextStep: modifiedNextStep.trim() } : {}), idempotencyKey: crypto.randomUUID() }) })
      if (!result.ok) throw new Error()
      const payload = await result.json()
      const updated = payload.action
      if (payload.runId) setActivityRunId(payload.runId)
      setPlan((current) => current ? { ...current, actions: current.actions.map((item) => item.id === updated.id ? { ...item, ...updated } : item) } : current)
      setStaleActionIds((current) => current.filter((id) => id !== updated.id))
      if (response === 'modified') setEditingRecommendation(false)
    } catch { setError(text.error) } finally { setBusy(false) }
  }

  async function scheduleFocusBlock() {
    if (!action) return
    setBusy(true); setError('')
    try {
      const start = new Date(Date.now() + 5 * 60 * 1000)
      const end = new Date(start.getTime() + (action.estimatedMinutes ?? 25) * 60 * 1000)
      const result = await fetch('/api/cognitive/loop/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId: action.id, start: start.toISOString(), end: end.toISOString(), idempotencyKey: crypto.randomUUID(), runId: activityRunId ?? undefined }) })
      if (!result.ok) throw new Error()
      setCalendarConfirmationOpen(false)
    } catch { setError(text.error) } finally { setBusy(false) }
  }

  return <section className="liquid-glass overflow-hidden rounded-[2rem] border border-primary/15 bg-primary/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
    <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-5 py-5 sm:px-7"><div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/75">{text.eyebrow}</p><h2 className="mt-1 text-xl font-black tracking-tight text-foreground/90">{text.title}</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{text.intro}</p></div><Sparkles className="mt-1 size-5 shrink-0 text-primary" aria-hidden /></div>
    <div className="px-5 py-5 sm:px-7">
      {busy && !plan ? <div className="space-y-3"><NovoActivitySurface runId={activityRunId} onCancel={cancelRun} /></div> : action ? <div className="space-y-5"><NovoActivitySurface runId={activityRunId} />
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">{action.status === 'accepted' ? text.accepted : `${language === 'es' ? 'Estado' : 'Status'}: ${action.status}`}</p><h3 className="mt-2 text-lg font-bold text-foreground">{action.title}</h3><p className="mt-2 text-sm leading-relaxed text-foreground/70">{action.nextStep}</p>{['accepted', 'started'].includes(action.status) && <label className="mt-3 block text-xs font-semibold text-foreground/75"><span>{language === 'es' ? 'Motivo obligatorio para abandonar o marcar un fallo' : 'Required reason to abandon or mark a failure'}</span><select value={outcomeReason} onChange={(event) => setOutcomeReason(event.target.value as OutcomeReason | '')} className="mt-2 w-full rounded-xl border border-foreground/10 bg-background/50 px-3 py-2 text-xs text-foreground"><option value="">{language === 'es' ? 'Selecciona un motivo' : 'Select a reason'}</option><option value="lack_of_time">{language === 'es' ? 'No tuve tiempo suficiente' : 'Not enough time'}</option><option value="too_large">{language === 'es' ? 'La acción era demasiado grande' : 'Action was too large'}</option><option value="external_dependency">{language === 'es' ? 'Dependencia externa' : 'External dependency'}</option><option value="priority_changed">{language === 'es' ? 'La prioridad cambió' : 'Priority changed'}</option><option value="incorrect_recommendation">{language === 'es' ? 'La recomendación era incorrecta' : 'Recommendation was incorrect'}</option><option value="insufficient_information">{language === 'es' ? 'Faltaba información' : 'Missing information'}</option><option value="technical_problem">{language === 'es' ? 'Fallo técnico' : 'Technical failure'}</option><option value="other">{language === 'es' ? 'Otro' : 'Other'}</option></select></label>}{staleActionIds.includes(action.id) && <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-xs text-foreground/80"><p>{language === 'es' ? 'Habías aceptado esta acción. ¿Qué ocurrió?' : 'You accepted this action. What happened?'}</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={() => respond('started')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'La inicié' : 'Started'}</button><button disabled={busy} onClick={() => respond('completed')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'La completé' : 'Completed'}</button><button disabled={busy} onClick={() => respond('postponed')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'La pospuse' : 'Postponed'}</button><button title={!outcomeReason ? (language === 'es' ? 'Selecciona un motivo primero' : 'Select a reason first') : undefined} disabled={busy || !outcomeReason} onClick={() => respond('abandoned')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'La abandoné' : 'Abandoned'}</button><button title={!outcomeReason ? (language === 'es' ? 'Selecciona un motivo primero' : 'Select a reason first') : undefined} disabled={busy || !outcomeReason} onClick={() => respond('failed')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'Falló' : 'Failed'}</button><button disabled={busy} onClick={() => respond('dismissed')} className="rounded-full border border-foreground/10 px-2.5 py-1.5 font-semibold">{language === 'es' ? 'Ya no es relevante' : 'No longer relevant'}</button></div></div>}<textarea value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder={language === 'es' ? 'Agrega contexto opcional' : 'Add optional context'} rows={2} className="mt-3 w-full resize-none rounded-2xl border border-foreground/10 bg-background/30 px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{text.facts}</p><ul className="mt-2 space-y-1 text-xs text-foreground/65">{action.facts?.map((fact) => <li key={fact} className="flex gap-2"><Check className="mt-0.5 size-3 shrink-0 text-emerald-400" />{fact}</li>)}</ul></div><div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{text.inference}</p><p className="mt-2 text-xs leading-relaxed text-foreground/65">{action.inferences?.join(' ')}</p></div></div>
        <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{language === 'es' ? 'Confianza' : 'Confidence'}</p><p className="mt-2 text-sm font-bold text-foreground">{confidencePresentation(action.confidence, language).label}</p><p className="mt-1 text-xs leading-relaxed text-foreground/65">{confidencePresentation(action.confidence, language).detail}</p></div>
        <SignalLedgerControls language={language === 'es' ? 'es' : 'en'} onChanged={() => setPlan(null)} />
        {editingRecommendation && <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3"><label className="text-xs font-semibold text-foreground/75">{language === 'es' ? 'Ajusta el siguiente paso' : 'Adjust the next step'}<textarea value={modifiedNextStep} onChange={(event) => setModifiedNextStep(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-foreground/10 bg-background/50 px-3 py-2 text-xs text-foreground" /></label><div className="mt-2 flex gap-2"><button disabled={busy || modifiedNextStep.trim().length < 3} onClick={() => respond('modified')} className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{language === 'es' ? 'Guardar ajuste' : 'Save adjustment'}</button><button onClick={() => setEditingRecommendation(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground">{language === 'es' ? 'Cancelar' : 'Cancel'}</button></div></div>}
        <div className="flex flex-wrap gap-2">{['proposed', 'modified', 'postponed'].includes(action.status) && <button disabled={busy} onClick={() => respond('accepted')} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{text.accept}<ChevronRight className="size-3.5" /></button>}{action.status === 'proposed' && <button disabled={busy} onClick={() => { setModifiedNextStep(action.nextStep); setEditingRecommendation(true) }} className="rounded-full border border-foreground/10 px-4 py-2.5 text-xs font-bold text-foreground/70 disabled:opacity-50">{text.modify}</button>}{['accepted', 'started'].includes(action.status) && <button disabled={busy} onClick={() => respond('completed')} className="rounded-full border border-foreground/10 px-4 py-2.5 text-xs font-bold text-foreground/70 disabled:opacity-50">{text.complete}</button>}{action.status === 'accepted' && <button disabled={busy} onClick={() => respond('started')} className="inline-flex items-center gap-2 rounded-full border border-primary/25 px-4 py-2.5 text-xs font-bold text-primary disabled:opacity-50"><Play className="size-3.5" />{language === 'es' ? 'Iniciar' : 'Start'}</button>}{['accepted', 'started'].includes(action.status) && <button disabled={busy} onClick={() => setCalendarConfirmationOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-primary/25 px-4 py-2.5 text-xs font-bold text-primary disabled:opacity-50"><CalendarPlus className="size-3.5" />{text.calendar}</button>}{['proposed', 'modified', 'accepted', 'started'].includes(action.status) && <button disabled={busy} onClick={() => respond('postponed')} className="rounded-full border border-foreground/10 px-4 py-2.5 text-xs font-bold text-foreground/60 disabled:opacity-50">{text.postpone}</button>}{['accepted', 'started'].includes(action.status) && <><button title={!outcomeReason ? (language === 'es' ? 'Selecciona un motivo primero' : 'Select a reason first') : undefined} disabled={busy || !outcomeReason} onClick={() => respond('abandoned')} className="rounded-full border border-foreground/10 px-4 py-2.5 text-xs font-bold text-foreground/60 disabled:opacity-50">{language === 'es' ? 'Abandonar' : 'Abandon'}</button><button title={!outcomeReason ? (language === 'es' ? 'Selecciona un motivo primero' : 'Select a reason first') : undefined} disabled={busy || !outcomeReason} onClick={() => respond('failed')} className="inline-flex items-center gap-1 rounded-full border border-rose-400/20 px-4 py-2.5 text-xs font-bold text-rose-400 disabled:opacity-50"><XCircle className="size-3.5" />{language === 'es' ? 'Marcar fallida' : 'Mark failed'}</button></>}{['proposed', 'modified', 'postponed', 'failed'].includes(action.status) && <button disabled={busy} onClick={() => respond('dismissed')} className="rounded-full px-3 py-2.5 text-xs font-semibold text-muted-foreground disabled:opacity-50">{text.dismiss}</button>}</div>
        {calendarConfirmationOpen && <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-3 text-xs text-foreground/80"><p className="font-semibold">{language === 'es' ? '¿Crear este bloque de enfoque en Google Calendar?' : 'Create this focus block in Google Calendar?'}</p><p className="mt-1 text-muted-foreground">{language === 'es' ? 'Se creará un bloque para esta recomendación. Puedes cancelarlo antes de enviarlo.' : 'A block will be created for this recommendation. You can cancel before sending it.'}</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={scheduleFocusBlock} className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{language === 'es' ? 'Confirmar bloque' : 'Confirm block'}</button><button disabled={busy} onClick={() => setCalendarConfirmationOpen(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground">{language === 'es' ? 'Cancelar' : 'Cancel'}</button></div></div>}
        {['completed', 'abandoned', 'failed'].includes(action.status) && <div className="flex items-center gap-2 border-t border-foreground/[0.06] pt-4"><span className="mr-1 text-[10px] uppercase tracking-widest text-muted-foreground">{text.why}</span><button aria-label={text.helpful} disabled={busy} onClick={() => respond('helpful')} className="rounded-full p-2 text-emerald-400 hover:bg-emerald-400/10"><ThumbsUp className="size-4" /></button><button aria-label={text.notHelpful} disabled={busy} onClick={() => respond('unhelpful')} className="rounded-full p-2 text-rose-400 hover:bg-rose-400/10"><ThumbsDown className="size-4" /></button><button aria-label={language === 'es' ? 'Fue intrusiva' : 'Intrusive'} disabled={busy} onClick={() => respond('intrusive')} className="rounded-full p-2 text-amber-400 hover:bg-amber-400/10"><CircleAlert className="size-4" /></button></div>}
      </div> : <div className="space-y-4">
        <label className="block text-xs font-bold text-foreground/75">{text.objective}<input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={text.objectivePlaceholder} className="mt-2 w-full rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm outline-none transition focus:border-primary/50" /></label><label className="block text-xs font-bold text-foreground/75">{text.context}<input value={context} onChange={(event) => setContext(event.target.value)} placeholder={text.contextPlaceholder} className="mt-2 w-full rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm outline-none transition focus:border-primary/50" /></label>
        <div className="grid gap-3 sm:grid-cols-4">{[[text.energy, energy, setEnergy], [text.focus, focus, setFocus], [text.workload, workload, setWorkload]].map(([label, value, setter]) => <label key={label as string} className="text-xs font-bold text-foreground/70">{label as string}<input type="range" min="1" max="5" value={value as number} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} className="mt-2 w-full accent-primary" /><span className="block text-right text-[10px] text-muted-foreground">{value as number}/5</span></label>)}<label className="text-xs font-bold text-foreground/70">{text.minutes}<input type="number" min="5" max="480" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-foreground/10 bg-background/40 px-3 py-2 text-sm" /></label></div>
        {error && <p className="flex items-center gap-2 text-xs text-rose-400"><CircleAlert className="size-4" />{error}</p>}<button disabled={busy} onClick={generatePlan} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{text.continue}<ChevronRight className="size-3.5" /></button>
      </div>}
    </div>
  </section>
}
