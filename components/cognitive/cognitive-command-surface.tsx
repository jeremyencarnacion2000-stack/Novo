'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleAlert, EyeOff, Loader2, Search, Sparkles } from 'lucide-react'
import type { CognitiveGraphNode, CognitiveGraphSnapshot, CognitiveLens } from '@/lib/cognitive-graph/types'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { TwinContextField } from '@/components/cognitive/twin-context-field'

const NovoActivitySurface = dynamic(
  () => import('@/components/ai/novo-activity-surface').then((module) => ({ default: module.NovoActivitySurface })),
  { ssr: false },
)

const LENSES: Array<{ id: CognitiveLens; label: string; description: string }> = [
  { id: 'now', label: 'Ahora', description: 'Lo que merece atención hoy' },
  { id: 'goals', label: 'Objetivos', description: 'Resultados y bloqueos' },
  { id: 'patterns', label: 'Patrones', description: 'Señales que se repiten' },
  { id: 'memory', label: 'Memoria', description: 'Lo que el Gemelo aprendió' },
  { id: 'sources', label: 'Fuentes', description: 'De dónde sale cada dato' },
]

type Props = { onPrimaryAction?: () => void }
type TwinAgentProposal = { id: string; reason: string; behavior: string }
type GraphMode = 'overview' | 'focus' | 'why'

function InspectorDetails({
  selected,
  selectedRelations,
  relationLabel,
  evidence,
  onExclude,
  onCorrect,
}: {
  selected: CognitiveGraphNode
  selectedRelations: CognitiveGraphSnapshot['edges']
  relationLabel: (edge: CognitiveGraphSnapshot['edges'][number]) => string
  evidence: CognitiveGraphSnapshot['evidence']
  onExclude: () => void
  onCorrect: () => void
}) {
  const impact = selected.actionIds.length > 0
    ? 'Influye en acciones'
    : selectedRelations.some((edge) => edge.kind === 'blocks')
      ? 'Afecta bloqueos'
      : 'Contexto del Twin'
  const updatedLabel = selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString() : 'Sin fecha'

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-foreground">{selected.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/62">{selected.summary ?? 'No hay una explicación adicional.'}</p>
      <dl className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-foreground/45">Confianza</dt><dd className="font-semibold text-foreground/75">{selected.confidence}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-foreground/45">Evidencias</dt><dd className="font-semibold text-foreground/75">{selected.evidenceIds.length}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-foreground/45">Estado</dt><dd className="font-semibold text-foreground/75">{selected.status ?? 'observación'}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-foreground/45">Actualizado</dt><dd className="font-semibold text-foreground/75">{updatedLabel}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-foreground/45">Impacto</dt><dd className="text-right font-semibold text-foreground/75">{impact}</dd></div>
      </dl>
      <div className="mt-4 border-t border-foreground/10 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Relaciones</p>
        {selectedRelations.length ? (
          <ul className="mt-2 space-y-1.5 text-xs text-foreground/62">
            {selectedRelations.map((edge) => <li key={edge.id}>• {relationLabel(edge)}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-foreground/50">No hay relaciones visibles en este lente.</p>
        )}
      </div>
      <div className="mt-4 border-t border-foreground/10 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">Evidencia</p>
        {evidence.length ? (
          <ul className="mt-2 space-y-2">
            {evidence.map((item) => (
              <li key={item.id} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('font-semibold', item.classification === 'model_inference' ? 'text-primary' : 'text-emerald-500')}>
                    {item.classification === 'model_inference' ? 'Inferencia' : 'Hecho'}
                  </span>
                  <span className="text-foreground/45">
                    {item.reliability === 'high' ? 'confianza alta' : item.reliability === 'medium' ? 'confianza media' : 'confianza limitada'}
                  </span>
                  <span className="text-foreground/40">{item.sourceType}</span>
                </div>
                <p className="mt-1 leading-relaxed text-foreground/70">{item.label}</p>
                <p className="mt-1 text-[10px] text-foreground/40">Observado: {new Date(item.observedAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-foreground/50">No hay evidencia disponible para este elemento.</p>
        )}
      </div>
      {selected.isCorrectable && selected.evidenceIds.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={onCorrect}
            aria-label="Corregir esta señal"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/65 hover:bg-foreground/[0.05]"
          >
            <EyeOff className="size-3.5" /> Corregir
          </button>
          <button
            onClick={onExclude}
            aria-label="Excluir esta señal"
            className="inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/65 hover:bg-foreground/[0.05]"
          >
            <EyeOff className="size-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  )
}

function WhyDossier({
  selected,
  evidence,
  relations,
  recommendation,
  onBack,
  onInspect,
  onCorrect,
  onExclude,
}: {
  selected: CognitiveGraphNode
  evidence: CognitiveGraphSnapshot['evidence']
  relations: CognitiveGraphSnapshot['edges']
  recommendation?: CognitiveGraphSnapshot['recommendation']
  onBack: () => void
  onInspect: () => void
  onCorrect: () => void
  onExclude: () => void
}) {
  const belief = selected.summary
    ?? (selected.isInferred
      ? `Novo está empezando a detectar que “${selected.label}” puede afectar tu manera de avanzar.`
      : `“${selected.label}” forma parte del contexto que Novo está usando ahora.`)
  const outcomes = relations.filter((relation) => relation.kind === 'learned_from' || relation.kind === 'executed_as' || relation.kind === 'caused_by')

  return (
    <section data-testid="twin-why-dossier" aria-labelledby="twin-why-title" className="rounded-[24px] border border-foreground/10 bg-foreground/[0.018] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="twin-why-title" className="text-xl font-semibold tracking-[-0.025em] text-foreground">Why Novo thinks this</h3>
          <p className="mt-1 text-sm text-foreground/60">Una explicación trazable de lo que Novo entendió y de la decisión que afecta.</p>
        </div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/72 transition-colors hover:bg-foreground/[0.05]"><ArrowLeft className="size-3.5" /> Volver al contexto</button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(15rem,.85fr)_minmax(0,1.15fr)]">
        <aside aria-label="Traza causal" className="rounded-2xl border border-foreground/10 bg-background/45 p-4">
          <p className="text-sm font-semibold text-foreground">Traza causal</p>
          <div className="mt-5 space-y-0">
            <div className="rounded-xl border border-foreground/[0.10] bg-foreground/[0.025] p-3">
              <p className="text-[11px] font-semibold text-foreground/70">Evidencia</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/55">{evidence.length ? `${evidence.length} observaciones conectadas` : 'Sin evidencia adicional en esta vista'}</p>
            </div>
            <div aria-hidden="true" className="mx-auto h-6 w-px bg-foreground/20" />
            <div className="rounded-xl border border-primary/35 bg-primary/[0.08] p-3">
              <p className="text-[11px] font-semibold text-foreground">{selected.label}</p>
              <p className="mt-1 text-xs text-foreground/58">{selected.isInferred ? 'Interpretación del Twin' : 'Contexto observado'}</p>
            </div>
            <div aria-hidden="true" className="mx-auto h-6 w-px bg-foreground/20" />
            <div className="rounded-xl border border-foreground/[0.10] bg-foreground/[0.025] p-3">
              <p className="text-[11px] font-semibold text-foreground/70">Efecto</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/55">{recommendation?.title ?? 'Mantiene este contexto disponible para tu siguiente decisión.'}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Lo que Novo entiende</h4>
            <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-foreground/68">{belief}</p>
          </div>

          <div className="mt-6 border-t border-foreground/10 pt-5">
            <h4 className="text-sm font-semibold text-foreground">Evidencia que lo respalda</h4>
            {evidence.length ? (
              <ul className="mt-3 space-y-2">
                {evidence.slice(0, 4).map((item) => (
                  <li key={item.id} className="rounded-xl border border-foreground/[0.09] bg-background/40 p-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <span className={cn('font-semibold', item.classification === 'model_inference' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-300')}>{item.classification === 'model_inference' ? 'Inferencia' : 'Hecho observado'}</span>
                      <span className="text-foreground/45">{item.sourceType}</span>
                      <span className="text-foreground/42">{new Date(item.observedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/68">{item.label}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-foreground/55">Aún no hay observaciones citables para esta parte del contexto.</p>}
          </div>

          <div className="mt-6 border-t border-foreground/10 pt-5">
            <h4 className="text-sm font-semibold text-foreground">Qué cambió</h4>
            <p className="mt-2 text-sm leading-relaxed text-foreground/62">{outcomes.length ? `Esta comprensión está conectada con ${outcomes.length} resultado${outcomes.length === 1 ? '' : 's'} reciente${outcomes.length === 1 ? '' : 's'}.` : 'Novo conserva este contexto para poder comprobar si cambia con nuevos resultados.'}</p>
          </div>

          <div className="mt-6 border-t border-foreground/10 pt-5">
            <h4 className="text-sm font-semibold text-foreground">Efecto en tu siguiente paso</h4>
            <p className="mt-2 text-sm leading-relaxed text-foreground/62">{recommendation?.rationale ?? 'Este contexto todavía no ha cambiado una acción recomendada.'}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-foreground/10 pt-5">
            <button type="button" onClick={onInspect} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"><Search className="size-3.5" /> Inspeccionar</button>
            {selected.isCorrectable && selected.evidenceIds.length > 0 && <>
              <button type="button" onClick={onCorrect} className="rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/72 transition-colors hover:bg-foreground/[0.05]">Corregir comprensión</button>
              <button type="button" onClick={onExclude} className="rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/72 transition-colors hover:bg-foreground/[0.05]">Excluir evidencia</button>
            </>}
          </div>
        </div>
      </div>
    </section>
  )
}

export function CognitiveCommandSurface({ onPrimaryAction }: Props) {
  const isMobile = useIsMobile()
  const [lens, setLens] = useState<CognitiveLens>('now')
  const [graphMode, setGraphMode] = useState<GraphMode>('overview')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<CognitiveGraphSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [inferenceRunId, setInferenceRunId] = useState<string | null>(null)
  const [agentProposals, setAgentProposals] = useState<TwinAgentProposal[]>([])
  const [agentTrust, setAgentTrust] = useState<{ confidenceScore: number; trustLevel: string } | null>(null)
  const [correctionNode, setCorrectionNode] = useState<CognitiveGraphNode | null>(null)
  const [correctionContext, setCorrectionContext] = useState('Novo no tiene todo el contexto')
  const [correctionNote, setCorrectionNote] = useState('')
  const [savingCorrection, setSavingCorrection] = useState(false)
  const lastSelectionRef = useRef<{ id: string; at: number } | null>(null)

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('lens')
    if (LENSES.some((item) => item.id === candidate)) setLens(candidate as CognitiveLens)
    setFocusNodeId(new URLSearchParams(window.location.search).get('focus'))
  }, [])

  useEffect(() => {
    if (!focusNodeId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') resetFocus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusNodeId])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    // The first authenticated request can include a cold server compilation
    // and the evidence-backed projection itself. Give that one bounded window
    // to finish instead of converting a slow-but-valid startup into a false
    // Cognitive error state. Subsequent requests are warm and return quickly.
    const timeout = window.setTimeout(() => controller.abort(), 45_000)
    setLoading(true)
    const params = new URLSearchParams({ lens })
    if (focusNodeId) params.set('focus', focusNodeId)
    fetch(`/api/cognitive/graph?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo recuperar el contexto operativo')
        return response.json() as Promise<{ snapshot?: CognitiveGraphSnapshot }>
      })
      .then((payload) => {
        if (!active) return
        setSnapshot(payload.snapshot ?? null)
        setSelectedId(focusNodeId)
        setGraphMode(focusNodeId ? 'focus' : 'overview')
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active && (cause as Error)?.name !== 'AbortError') setError('No se pudo cargar el Centro Cognitivo')
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) setLoading(false)
      })
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [lens, focusNodeId, retryKey])

  useEffect(() => {
    const refreshSnapshot = () => setRetryKey((value) => value + 1)
    window.addEventListener('novo:twin-updated', refreshSnapshot)
    return () => window.removeEventListener('novo:twin-updated', refreshSnapshot)
  }, [])

  useEffect(() => {
    let active = true
    const refreshAgentState = async () => {
      try {
        const response = await fetch('/api/cognitive/agent-actions', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json() as { proposals?: TwinAgentProposal[]; twin?: { confidenceScore: number; trustLevel: string } | null }
        if (!active) return
        setAgentProposals(Array.isArray(payload.proposals) ? payload.proposals : [])
        setAgentTrust(payload.twin ?? null)
      } catch {
        // progressive enhancement
      }
    }
    void refreshAgentState()
    const timer = window.setInterval(() => void refreshAgentState(), 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [retryKey])

  useEffect(() => {
    let active = true
    const refreshInference = async () => {
      try {
        const response = await fetch('/api/cognitive/inference/status', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json() as { run?: { id?: string } | null }
        if (active) setInferenceRunId(payload.run?.id ?? null)
      } catch {
        // progressive enhancement
      }
    }
    void refreshInference()
    const timer = window.setInterval(() => void refreshInference(), 10_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return snapshot?.nodes ?? []
    return (snapshot?.nodes ?? []).filter((node) => `${node.label} ${node.summary ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [snapshot, query])

  const selected = useMemo(() => snapshot?.nodes.find((node) => node.id === selectedId) ?? null, [snapshot, selectedId])
  const selectedRelations = useMemo(
    () => (selected && snapshot ? snapshot.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id).slice(0, 6) : []),
    [selected, snapshot],
  )
  const attention = useMemo(
    () => (snapshot?.nodes ?? []).filter((node) => node.kind === 'blocker' || node.kind === 'action' || node.kind === 'intervention').slice(0, 4),
    [snapshot],
  )
  const facts = snapshot?.recommendation?.facts ?? []
  const inferences = snapshot?.recommendation?.inferences ?? []
  const relationLabel = (edge: CognitiveGraphSnapshot['edges'][number]) => edge.source === selected?.id
    ? `se relaciona con ${snapshot?.nodes.find((node) => node.id === edge.target)?.label ?? 'otro elemento'}`
    : `se relaciona desde ${snapshot?.nodes.find((node) => node.id === edge.source)?.label ?? 'otro elemento'}`
  const visibleError = error ?? (!loading && !snapshot ? 'No se pudo recuperar el contexto cognitivo. Intenta actualizar para reanudar.' : null)
  const learningNodes = snapshot?.nodes.filter((node) => node.cluster === 'learning' || node.cluster === 'adaptation') ?? []

  function selectNode(nodeId: string) {
    const now = Date.now()
    if (lastSelectionRef.current?.id === nodeId && now - lastSelectionRef.current.at < 420) {
      setInspectorOpen(true)
      return
    }
    lastSelectionRef.current = { id: nodeId, at: now }
    setSelectedId(nodeId)
    setGraphMode('focus')
  }

  function selectLens(nextLens: CognitiveLens) {
    setLens(nextLens)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.set('lens', nextLens)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    }
  }

  function focusNode(nodeId: string) {
    setFocusNodeId(nodeId)
    setSelectedId(nodeId)
    setInspectorOpen(true)
    setGraphMode('focus')
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.set('focus', nodeId)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    }
  }

  function resetFocus() {
    setFocusNodeId(null)
    setSelectedId(null)
    setInspectorOpen(false)
    setGraphMode('overview')
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.delete('focus')
      const queryString = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`)
    }
  }

  function openCorrection(node: CognitiveGraphNode) {
    setCorrectionNode(node)
    setCorrectionContext('Novo no tiene todo el contexto')
    setCorrectionNote('')
  }

  async function correctSignal(node: CognitiveGraphNode, correction: string) {
    const evidenceId = node.evidenceIds[0]
    if (!evidenceId) return
    if (!correction?.trim()) return
    try {
      const response = await fetch('/api/cognitive/loop/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalId: evidenceId.replace(/^evidence:/, ''),
          action: 'correct',
          correction: correction.trim(),
          reason: 'user_corrected_from_cognitive_identity',
        }),
      })
      if (!response.ok) {
        setError('No se pudo guardar la corrección. El mapa conserva su estado anterior.')
        return
      }
      setRetryKey((value) => value + 1)
      setCorrectionNode(null)
      setCorrectionNote('')
    } catch {
      setError('No se pudo guardar la corrección. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  async function excludeSignal(node: CognitiveGraphNode) {
    const evidenceId = node.evidenceIds[0]
    if (!evidenceId) return
    try {
      const response = await fetch('/api/cognitive/loop/signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signalId: evidenceId.replace(/^evidence:/, ''),
          action: 'exclude',
          reason: 'user_excluded_from_cognitive_center',
        }),
      })
      if (!response.ok) {
        setError('No se pudo excluir esta señal. El mapa conserva su estado anterior.')
        return
      }
      setSnapshot((current) => current ? { ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, isExcluded: true } : item) } : current)
    } catch {
      setError('No se pudo excluir esta señal. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  return (
    <section aria-labelledby="cognitive-center-title" className="flex flex-col gap-4">
      {snapshot && (() => {
        const identityNodes = snapshot.nodes.filter((node) => (node.kind === 'pattern' || node.kind === 'memory') && node.evidenceIds.length > 0).slice(0, 3)
        const evidenceCount = snapshot.evidence.length
        const inferredCount = identityNodes.filter((node) => node.isInferred).length
        return (
          <article data-testid="cognitive-identity" className="order-4 rounded-[26px] border border-primary/15 bg-primary/[0.045] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/75">Cognitive Identity</p>
                <h2 id="cognitive-identity-title" className="mt-2 text-xl font-semibold tracking-tight text-foreground">Así es como Novo te entiende</h2>
                <p className="mt-1 max-w-xl text-sm text-foreground/60">Un modelo operativo corregible, construido a partir de señales y resultados reales.</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 text-[11px] font-medium text-primary">{identityNodes.length ? 'Aprendizaje activo' : 'Reuniendo evidencia'}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {identityNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  className="rounded-2xl border border-foreground/10 bg-background/35 p-4 text-left transition-colors hover:bg-background/60"
                >
                  <span className="block text-sm font-medium text-foreground">{node.label}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-foreground/55">{node.summary ?? 'Patrón en observación.'}</span>
                  <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                    {node.evidenceIds.length} evidencias · confianza {node.confidence} · {node.status ?? 'observación'}
                  </span>
                  <span className="mt-1 block text-[10px] text-foreground/35">Actualizado {node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : 'sin fecha'}</span>
                </button>
              ))}
              {!identityNodes.length && <p className="text-sm text-foreground/60">Aún no tengo suficiente evidencia para describir tu forma de operar. Sigue usando Novo y podrás corregir lo que aprenda.</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-foreground/10 pt-4 text-xs text-foreground/55">
              <span>{evidenceCount} evidencias consultadas</span>
              <span>{inferredCount} inferencias explícitas</span>
              <span>Selecciona un patrón para ver por qué existe</span>
            </div>
          </article>
        )
      })()}

      <div data-testid="cognitive-heading" className="order-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="cognitive-center-title" className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">Centro Cognitivo</h2>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-foreground/65">Una vista operativa de lo que cambió, qué importa ahora y cómo Novo llegó a esa recomendación.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-1" role="tablist" aria-label="Lentes del Centro Cognitivo">
          {LENSES.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={lens === item.id}
              onClick={() => selectLens(item.id)}
              className={cn('rounded-xl px-3 py-2 text-xs font-semibold transition-colors', lens === item.id ? 'bg-foreground text-background shadow-sm' : 'text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {inferenceRunId && (
        <div className="order-5 rounded-[26px] border border-primary/15 bg-primary/[0.035] p-4 sm:p-5" aria-live="polite">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/75">Pensamiento del Twin</p>
            <p className="mt-1 text-xs text-foreground/55">Etapas reales de observación, comprensión, propuesta, verificación, aprendizaje y adaptación.</p>
          </div>
          <NovoActivitySurface runId={inferenceRunId} />
        </div>
      )}

      {agentProposals.length > 0 && (
        <article className="order-6 rounded-[26px] border border-amber-400/20 bg-amber-400/[0.045] p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/80">Adaptaciones preparadas</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">El Twin propone ajustar su comportamiento</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/60">Estas propuestas ya influyen en el siguiente Focus Plan. Ninguna acción externa se ejecuta sin tu confirmación.</p>
            </div>
            <span className="rounded-full border border-amber-400/20 px-2.5 py-1 text-[10px] font-semibold text-amber-500">Confirmación requerida</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {agentProposals.map((proposal) => (
              <div key={proposal.id} className="rounded-2xl border border-foreground/10 bg-background/30 p-3">
                <p className="text-xs font-semibold text-foreground/85">{proposal.behavior}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground/55">{proposal.reason}</p>
              </div>
            ))}
          </div>
          {agentTrust && <p className="mt-4 text-[10px] text-foreground/45">Calibración actual: confianza {agentTrust.confidenceScore.toFixed(1)}% · nivel {agentTrust.trustLevel}</p>}
        </article>
      )}

      {loading && (
        <div className="order-2 flex min-h-28 items-center gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-5 text-sm text-foreground/65" role="status">
          <Loader2 className="size-4 animate-spin text-primary" /> Recuperando señales reales de tu contexto…
        </div>
      )}

      {visibleError && !loading && (
        <div className="order-2 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-5 text-sm text-red-200" role="alert">
          <span className="flex items-center gap-3"><CircleAlert className="size-4" /> {visibleError}</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="rounded-xl border border-red-200/20 px-3 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-100/10">Intentar de nuevo</button>
        </div>
      )}

      {snapshot && !loading && (
        <>
          {learningNodes.length ? (
            <article className="order-7 rounded-[26px] border border-primary/15 bg-primary/[0.025] p-4 sm:p-5" aria-live="polite">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Nuevo aprendizaje del Twin</h3>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/55">Cada nodo nace de evidencia, conserva su explicación y muestra el comportamiento que puede cambiar.</p>
                </div>
                <span className="text-xs font-medium text-primary">{learningNodes.length} aprendizaje{learningNodes.length === 1 ? '' : 's'} visible{learningNodes.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {learningNodes.slice(0, 8).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => selectNode(node.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors',
                      selectedId === node.id ? 'border-primary/45 bg-primary/10 text-primary' : 'border-foreground/10 bg-background/30 text-foreground/68 hover:bg-foreground/[0.05]',
                    )}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
            </article>
          ) : (
            <article className="order-7 rounded-[26px] border border-foreground/10 bg-foreground/[0.02] p-5" aria-live="polite">
              <h3 className="text-base font-semibold text-foreground">El Twin aún está reuniendo evidencia</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/60">Cuando un resultado o corrección cambie cómo Novo te ayuda, aparecerá aquí como un aprendizaje explicable y navegable.</p>
            </article>
          )}

          <article data-testid="twin-context-card" className="order-3 rounded-[26px] border border-primary/15 bg-primary/[0.025] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{graphMode === 'why' ? 'Evidencia y efecto' : 'Campo cognitivo actual'}</h3>
                <p className="mt-1 max-w-2xl text-xs text-foreground/50">{graphMode === 'why' ? 'Una explicación trazable de esta comprensión.' : 'Novo muestra primero el contexto que está influyendo en tu siguiente decisión.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={resetFocus}
                  className="rounded-xl border border-foreground/10 bg-background/30 px-3 py-2 text-[11px] font-semibold text-foreground/58 hover:bg-foreground/[0.05]"
                >
                  {graphMode === 'overview' ? 'Contexto actual' : 'Recentrar'}
                </button>
              </div>
            </div>
            <div className="mt-4">
              {graphMode === 'why' && selected ? (
                <WhyDossier
                  selected={selected}
                  evidence={snapshot.evidence.filter((item) => selected.evidenceIds.includes(item.id))}
                  relations={selectedRelations}
                  recommendation={snapshot.recommendation}
                  onBack={() => setGraphMode('focus')}
                  onInspect={() => setInspectorOpen(true)}
                  onCorrect={() => openCorrection(selected)}
                  onExclude={() => excludeSignal(selected)}
                />
              ) : (
                <TwinContextField
                  snapshot={snapshot}
                  selectedId={selectedId}
                  mode={graphMode === 'focus' ? 'focus' : 'overview'}
                  onSelectNode={selectNode}
                  onWhy={() => selected && setGraphMode('why')}
                  onInspect={() => setInspectorOpen(true)}
                  onPrimaryAction={onPrimaryAction}
                />
              )}
            </div>
          </article>

          <div className="order-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
            <article className="rounded-[26px] border border-primary/20 bg-primary/[0.07] p-5 shadow-[0_24px_60px_-44px_color-mix(in_srgb,var(--primary)_50%,transparent)] sm:p-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="size-4" /> Siguiente acción recomendada</div>
              <h3 className="mt-4 max-w-[32ch] text-2xl font-semibold tracking-[-0.03em] text-foreground">{snapshot.recommendation?.title ?? 'Aún no hay una acción priorizada'}</h3>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-foreground/68">{snapshot.recommendation?.nextStep ?? 'Completa una señal o un objetivo para que Novo pueda priorizar con evidencia.'}</p>
              {snapshot.recommendation && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={onPrimaryAction} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-transform hover:-translate-y-0.5">Comenzar <ArrowUpRight className="size-3.5" /></button>
                  <button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-4 py-2.5 text-xs font-semibold text-foreground/75 hover:bg-foreground/[0.05]">Por qué esto <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} /></button>
                </div>
              )}
              {expanded && snapshot.recommendation && (
                <div className="mt-5 grid gap-4 border-t border-foreground/10 pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Hechos usados</p>
                    <ul className="mt-2 space-y-2 text-xs leading-relaxed text-foreground/72">
                      {facts.length ? facts.map((fact) => <li key={fact} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />{fact}</li>) : <li>No hay hechos adicionales disponibles.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Interpretación de Novo</p>
                    <ul className="mt-2 space-y-2 text-xs leading-relaxed text-foreground/72">
                      {inferences.length ? inferences.map((fact) => <li key={fact} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />{fact}</li>) : <li>La confianza es limitada hasta recibir más contexto.</li>}
                    </ul>
                  </div>
                </div>
              )}
            </article>
            <aside className="rounded-[26px] border border-foreground/10 bg-foreground/[0.025] p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Atención ahora</p>
              <div className="mt-4 space-y-2">
                {attention.length ? attention.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-foreground/10 p-3 text-left transition-colors hover:bg-foreground/[0.05]"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground/85">{node.label}</span>
                      <span className="mt-1 block text-xs text-foreground/50">{node.summary}</span>
                    </span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  </button>
                )) : <p className="text-sm leading-relaxed text-foreground/55">No hay bloqueos destacados en este lente.</p>}
              </div>
            </aside>
          </div>

          <div className="order-9 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,.38fr)]">
            <div className="rounded-[26px] border border-foreground/10 bg-foreground/[0.02] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Contexto conectado</h3>
                  <p className="mt-1 text-xs text-foreground/50">{LENSES.find((item) => item.id === lens)?.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex min-w-40 items-center gap-2 rounded-xl border border-foreground/10 bg-background/35 px-2.5 py-2 text-xs text-foreground/60">
                    <Search className="size-3.5 shrink-0" />
                    <span className="sr-only">Buscar en el contexto</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar contexto"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-foreground/35"
                    />
                  </label>
                  <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[10px] font-semibold text-foreground/55">{visibleNodes.length} elementos</span>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {visibleNodes.slice(0, 10).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      selectedId === node.id ? 'border-primary/40 bg-primary/[0.08]' : 'border-foreground/10 hover:bg-foreground/[0.05]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground/85">{node.label}</span>
                      {node.isInferred && <span className="text-[10px] text-primary">inferido</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/52">{node.summary ?? 'Sin detalle adicional'}</p>
                  </button>
                ))}
                {query && visibleNodes.length === 0 && <p className="text-xs text-foreground/50">No se encontraron elementos para esta búsqueda.</p>}
              </div>
            </div>
            <div className="hidden rounded-[26px] border border-foreground/10 bg-foreground/[0.02] p-5 lg:block" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">Inspector</p>
              {selected ? (
                <InspectorDetails
                  selected={selected}
                  selectedRelations={selectedRelations}
                  relationLabel={relationLabel}
                  evidence={snapshot.evidence.filter((item) => selected.evidenceIds.includes(item.id))}
                  onExclude={() => excludeSignal(selected)}
                  onCorrect={() => openCorrection(selected)}
                />
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-foreground/55">Selecciona un elemento para ver sus hechos, confianza y controles.</p>
              )}
            </div>
          </div>

          <div className="order-10 rounded-[26px] border border-foreground/10 bg-foreground/[0.02] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Lo que Novo aprendió</h3>
                <p className="mt-1 text-xs text-foreground/50">Cambios derivados de resultados reales, no de una puntuación decorativa.</p>
              </div>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[10px] font-semibold text-foreground/55">{snapshot.changes.changedNodeIds.length} cambios</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {snapshot.nodes.filter((node) => node.kind === 'memory' || node.kind === 'pattern').slice(0, 5).map((node) => (
                <button key={node.id} onClick={() => selectNode(node.id)} className="rounded-xl border border-foreground/10 px-3 py-2 text-left text-xs text-foreground/70 hover:bg-foreground/[0.05]">
                  {node.label}
                </button>
              ))}
              {snapshot.changes.changedNodeIds.length === 0 && <p className="text-xs text-foreground/50">Aún no hay un outcome suficiente para adaptar la estrategia.</p>}
            </div>
          </div>
        </>
      )}

      <Sheet open={!!correctionNode} onOpenChange={(open) => { if (!open && !savingCorrection) setCorrectionNode(null) }}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className="max-h-[82dvh] overflow-y-auto border-foreground/10 bg-background/95 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <SheetHeader className="px-5 pb-2 text-left">
            <SheetTitle>Corrige la comprensión de Novo</SheetTitle>
            <SheetDescription>Tu corrección se guarda con esta evidencia y actualiza el contexto del Twin.</SheetDescription>
          </SheetHeader>
          {correctionNode && (
            <div className="space-y-5 px-5 pb-5">
              <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-3">
                <p className="text-sm font-semibold text-foreground">{correctionNode.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/58">{correctionNode.summary ?? 'Esta señal está influyendo en el contexto actual.'}</p>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">¿Qué necesita corregir Novo?</legend>
                <div className="mt-3 space-y-2">
                  {[
                    'Esto no es cierto',
                    'Solo ocurre en algunos contextos',
                    'Novo no tiene todo el contexto',
                    'Deja de aprender de esta fuente',
                  ].map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-foreground/10 px-3 py-2.5 text-sm text-foreground/72 transition-colors hover:bg-foreground/[0.04]">
                      <input type="radio" name="twin-correction-kind" value={option} checked={correctionContext === option} onChange={() => setCorrectionContext(option)} className="size-4 accent-primary" />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-semibold text-foreground">
                Añade contexto <span className="font-normal text-foreground/48">(opcional)</span>
                <textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Por ejemplo, esto ocurre mientras espero una compilación." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-foreground/15 bg-foreground/[0.025] p-3 text-sm font-normal text-foreground outline-none placeholder:text-foreground/38 focus:border-primary/55" />
              </label>
              <button
                type="button"
                disabled={savingCorrection}
                onClick={async () => {
                  setSavingCorrection(true)
                  await correctSignal(correctionNode, [correctionContext, correctionNote.trim()].filter(Boolean).join('. '))
                  setSavingCorrection(false)
                }}
                className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity disabled:cursor-wait disabled:opacity-60"
              >
                {savingCorrection ? 'Guardando corrección…' : 'Guardar corrección'}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isMobile && inspectorOpen && !!selected} onOpenChange={setInspectorOpen}>
        <SheetContent side="bottom" className="max-h-[78dvh] overflow-y-auto border-foreground/10 bg-background/95 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
          <SheetHeader className="px-5 pb-2 text-left">
            <SheetTitle>Detalle del contexto</SheetTitle>
            <SheetDescription>Hechos, relaciones y controles de este elemento.</SheetDescription>
          </SheetHeader>
          {snapshot && selected && (
            <div className="px-5 pb-5" aria-live="polite">
              <InspectorDetails
                selected={selected}
                selectedRelations={selectedRelations}
                relationLabel={relationLabel}
                evidence={snapshot.evidence.filter((item) => selected.evidenceIds.includes(item.id))}
                onExclude={() => excludeSignal(selected)}
                onCorrect={() => openCorrection(selected)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
