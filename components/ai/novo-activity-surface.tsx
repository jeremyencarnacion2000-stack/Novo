'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, RotateCw, Square } from 'lucide-react'
import { mergeNovoActivityEvents, type NovoActivityEvent } from '@/lib/ai/activity-contract'
import { NovoThinkingOrb } from '@/components/ai/novo-thinking-orb'

type ActivityRun = { id: string; status: string; sequence: number; phase: string; errorMessage?: string | null }

const phaseLabels: Record<string, { label: string; done: string }> = {
  initializing: { label: 'Iniciando Novo', done: 'Novo iniciado' },
  retrieving_context: { label: 'Recuperando tu contexto', done: 'Contexto recuperado' },
  interpreting_signals: { label: 'Revisando señales recientes', done: 'Señales revisadas' },
  evaluating_constraints: { label: 'Evaluando restricciones', done: 'Restricciones evaluadas' },
  prioritizing: { label: 'Evaluando prioridades', done: 'Prioridades evaluadas' },
  planning: { label: 'Preparando tu siguiente acción', done: 'Siguiente acción preparada' },
  calling_tool: { label: 'Usando una herramienta aprobada', done: 'Herramienta utilizada' },
  awaiting_confirmation: { label: 'Esperando tu confirmación', done: 'Confirmación recibida' },
  executing_action: { label: 'Ejecutando el cambio', done: 'Cambio ejecutado' },
  verifying_result: { label: 'Verificando el resultado', done: 'Resultado verificado' },
  learning: { label: 'Actualizando el aprendizaje', done: 'Aprendizaje actualizado' },
  adapting: { label: 'Adaptando el siguiente comportamiento', done: 'Comportamiento adaptado' },
  composing_response: { label: 'Preparando la respuesta', done: 'Respuesta preparada' },
  completed: { label: 'Plan listo', done: 'Plan listo' },
  failed: { label: 'No se pudo completar', done: 'No se pudo completar' },
  cancelled: { label: 'Ejecución detenida', done: 'Ejecución detenida' },
}

export function NovoActivitySurface({ runId, onCancel }: { runId: string | null; onCancel?: () => void }) {
  const [events, setEvents] = useState<NovoActivityEvent[]>([])
  const [run, setRun] = useState<ActivityRun | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)

  useEffect(() => {
    if (!runId) return
    setEvents([]); setRun(null); setDisconnected(false)
    let lastSequence = 0
    let hasDisconnected = false
    let pollingTelemetrySent = false
    let source: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    const apply = (payload: any) => {
      if (payload?.type === 'activity' && payload.event) {
        const incoming = payload.event as NovoActivityEvent
        // The SSE transport can deliver a later persisted frame before an
        // earlier one. Keep the highest cursor for recovery, but merge every
        // frame so the timeline remains complete and deterministic.
        lastSequence = Math.max(lastSequence, incoming.sequence)
        setEvents((current) => mergeNovoActivityEvents(current, [incoming]))
      }
      if (payload?.type === 'run' && payload.run) setRun(payload.run)
      if (payload?.error === 'activity_stream_disconnected') setDisconnected(true)
    }
    const recover = async () => {
      try {
        const response = await fetch(`/api/ai/activity/runs/${runId}?after=${lastSequence}`, { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        for (const event of payload.events ?? []) apply({ type: 'activity', event })
        apply({ type: 'run', run: payload.run })
        if (['completed', 'failed', 'cancelled', 'expired'].includes(payload.run?.status)) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
          return
        }
        setDisconnected(false)
        if (hasDisconnected) {
          void fetch(`/api/ai/activity/runs/${runId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'telemetry', event: 'reconnected' }) }).catch(() => undefined)
          hasDisconnected = false
        }
        connect()
      } catch {
        setDisconnected(true)
      }
    }
    const connect = () => {
      source?.close()
      source = new EventSource(`/api/ai/activity/runs/${runId}/stream?after=${lastSequence}`)
      source.onmessage = (message) => { try { apply(JSON.parse(message.data)) } catch { /* ignore malformed frames */ } }
      source.onerror = () => {
        setDisconnected(true)
        hasDisconnected = true
        source?.close()
        if (!pollTimer) {
          pollTimer = setInterval(recover, 2_000)
          if (!pollingTelemetrySent) {
            pollingTelemetrySent = true
            void fetch(`/api/ai/activity/runs/${runId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'telemetry', event: 'polling_fallback' }) }).catch(() => undefined)
          }
        }
        void recover()
      }
    }
    connect()
    return () => { source?.close(); if (pollTimer) clearInterval(pollTimer) }
  }, [runId, connectionAttempt])

  const current = events[events.length - 1]
  const copy = phaseLabels[current?.phase ?? run?.phase ?? 'initializing'] ?? phaseLabels.initializing
  const terminal = ['completed', 'failed', 'cancelled', 'expired'].includes(run?.status ?? '')
  const detail = current?.detail
  const timeline = useMemo(() => events.slice(-6), [events])
  if (!runId) return null
  const retryConnection = () => {
    void fetch(`/api/ai/activity/runs/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'telemetry', event: 'retry' }),
    }).catch(() => undefined)
    setConnectionAttempt((value) => value + 1)
  }
  const terminalPhase = current?.phase ?? run?.phase
  return <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3 text-foreground">
    <div className="flex items-center gap-3">
      <NovoThinkingOrb
        phase={terminalPhase}
        status={terminal ? (run?.status as 'completed' | 'failed' | 'cancelled' | 'expired') : disconnected ? 'disconnected' : 'active'}
        label={terminal ? copy.done : copy.label}
      />
      {disconnected && <CircleAlert className="size-4 text-amber-500" aria-hidden />}
      <div className="min-w-0 flex-1"><p aria-live="polite" aria-atomic="true" className="text-xs font-semibold">{terminal ? copy.done : copy.label}</p>{detail && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>}</div>
      {!terminal && onCancel && <button onClick={onCancel} className="rounded-full p-2 text-muted-foreground hover:bg-foreground/10" aria-label="Detener ejecución"><Square className="size-3.5" /></button>}
      {disconnected && <button onClick={retryConnection} className="rounded-full p-2 text-muted-foreground hover:bg-foreground/10" aria-label="Reintentar conexión"><RotateCw className="size-3.5" /></button>}
      <button onClick={() => setExpanded((value) => !value)} className="rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-foreground/10" aria-expanded={expanded}>{expanded ? 'Ocultar' : 'Detalles'}</button>
    </div>
    {expanded && <ol className="mt-3 space-y-2 border-t border-foreground/10 pt-3">{timeline.map((item) => <li key={`${item.runId}-${item.sequence}`} className="flex items-start gap-2 text-[11px]"><span className="mt-0.5 size-3 rounded-full border border-primary/50" aria-hidden /><span className="text-foreground/75">{item.label}{item.detail ? <span className="block text-muted-foreground">{item.detail}</span> : null}</span></li>)}</ol>}
  </section>
}
