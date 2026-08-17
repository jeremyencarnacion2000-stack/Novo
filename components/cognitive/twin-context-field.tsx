'use client'

import { ArrowUpRight, FileText, Search } from 'lucide-react'
import { useMemo } from 'react'
import { buildTwinGraphViewModel, type TwinGraphContext, type TwinGraphSemanticRole } from '@/lib/cognitive-graph/twin-graph-view-model'
import type { CognitiveGraphSnapshot } from '@/lib/cognitive-graph/types'
import { cn } from '@/lib/utils'

type Props = {
  snapshot: CognitiveGraphSnapshot
  selectedId: string | null
  mode: 'overview' | 'focus'
  onSelectNode: (id: string) => void
  onWhy?: () => void
  onInspect?: () => void
  onPrimaryAction?: () => void
}

const ROLE_LABELS: Record<TwinGraphSemanticRole, string> = {
  fact: 'Hecho',
  observation: 'Observación',
  inference: 'Inferencia',
  'emerging-pattern': 'Patrón emergente',
  'confirmed-pattern': 'Patrón confirmado',
  outcome: 'Resultado',
  'recommended-action': 'Acción recomendada',
}

function placement(position: TwinGraphContext['position']) {
  if (position.x > 68) return '-translate-x-full'
  if (position.x < 32) return 'translate-x-0'
  return '-translate-x-1/2'
}

function SemanticMark({ role }: { role: TwinGraphSemanticRole }) {
  return (
    <span aria-hidden="true" className={cn(
      'relative inline-flex shrink-0 items-center justify-center',
      role === 'fact' && 'size-3 rounded-full bg-primary',
      role === 'observation' && 'size-2 rounded-full bg-primary/70',
      role === 'inference' && 'size-3 rounded-full border border-primary bg-transparent',
      role === 'emerging-pattern' && 'size-3.5 rounded-full border border-dashed border-primary after:absolute after:inset-[3px] after:rounded-full after:bg-primary/35',
      role === 'confirmed-pattern' && 'size-3.5 rounded-full border border-primary bg-primary/25 ring-2 ring-primary/20',
      role === 'outcome' && 'size-3 rounded-[3px] bg-primary/65 rotate-45',
      role === 'recommended-action' && 'size-3 rounded-[2px] bg-primary',
    )} />
  )
}

function ContextNode({ context, selected, muted, onSelect }: { context: TwinGraphContext; selected: boolean; muted?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      data-testid={`twin-context-node-${context.node.id}`}
      data-semantic-role={context.role}
      onClick={onSelect}
      style={{ left: `${context.position.x}%`, top: `${context.position.y}%` }}
      className={cn(
        'absolute z-10 w-[min(42vw,12.5rem)] text-left motion-reduce:transition-none',
        placement(context.position),
        'transition-[left,top,opacity,transform] duration-500 ease-[cubic-bezier(0.2,0,0,1)]',
        muted ? 'scale-[.94] opacity-45' : 'opacity-100',
      )}
      aria-pressed={selected}
    >
      <span className={cn(
        'block rounded-2xl border px-3 py-2.5 shadow-[0_12px_28px_-24px_rgba(0,0,0,.65)] transition-colors duration-150',
        selected ? 'border-primary/50 bg-primary/[0.10]' : 'border-foreground/[0.10] bg-background/70 hover:border-primary/35 hover:bg-background/90',
      )}>
        <span className="flex items-start gap-2">
          <SemanticMark role={context.role} />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-foreground">{context.node.label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-foreground/55">{ROLE_LABELS[context.role]}{context.relatedCount > 1 ? ` · ${context.relatedCount} relaciones` : ''}</span>
          </span>
        </span>
      </span>
    </button>
  )
}

function Connector({ from, to, muted = false, dashed = false }: { from: TwinGraphContext['position']; to: TwinGraphContext['position']; muted?: boolean; dashed?: boolean }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="currentColor"
      strokeWidth={muted ? .3 : .55}
      strokeDasharray={dashed ? '1.4 1.7' : undefined}
      className={cn('text-foreground/20 transition-opacity duration-500', muted && 'opacity-35')}
    />
  )
}

/**
 * THESIS: The Twin begins with shared context, never a decorative universe.
 * OWN-WORLD: restrained graphite surfaces, warm neutral light and evidence-green state marks.
 * STORY: a bounded field leads to one inspectable causal understanding and its next decision.
 * FIRST VIEWPORT: central current-context anchor, five dominant contexts and one actionable rail.
 * FORM: operate-mode cognitive field; canonical projection only; unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */
export function TwinContextField({ snapshot, selectedId, mode, onSelectNode, onWhy, onInspect, onPrimaryAction }: Props) {
  const view = useMemo(() => buildTwinGraphViewModel(snapshot, mode === 'focus' ? selectedId : null), [mode, selectedId, snapshot])
  const focus = mode === 'focus' ? view.focus : undefined
  const selected = focus?.selected
  const contexts = focus ? [...focus.supporting, focus.selected, ...focus.affected, ...focus.remote] : view.dominantContexts

  if (view.dominantContexts.length === 0) {
    return (
      <div data-testid="twin-context-empty" className="rounded-[24px] border border-foreground/10 bg-foreground/[0.02] px-5 py-12 text-center">
        <h3 className="text-base font-semibold text-foreground">Novo todavía está construyendo tu contexto.</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground/60">Cuando haya señales y resultados suficientes, aquí verás qué entiende Novo y qué está cambiando.</p>
      </div>
    )
  }

  return (
    <section data-testid="twin-context-field" aria-label="Campo de contexto actual del Twin" className="overflow-hidden rounded-[24px] border border-foreground/10 bg-foreground/[0.018]">
      <div className="relative min-h-[27rem] overflow-hidden p-4 sm:min-h-[30rem] sm:p-6">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,color-mix(in_srgb,var(--primary)_11%,transparent),transparent_50%)]" />
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {focus ? (
            <>
              {focus.supporting.map((context) => <Connector key={`support-${context.node.id}`} from={context.position} to={focus.selected.position} />)}
              {focus.affected.map((context) => <Connector key={`affected-${context.node.id}`} from={focus.selected.position} to={context.position} />)}
              {focus.remote.map((context) => <Connector key={`remote-${context.node.id}`} from={focus.selected.position} to={context.position} muted dashed />)}
            </>
          ) : view.dominantContexts.map((context) => (
            <Connector key={`overview-${context.node.id}`} from={view.anchor.position} to={context.position} muted={context.role === 'observation'} dashed={context.role === 'inference'} />
          ))}
        </svg>

        {!focus && (
          <div
            data-testid="twin-context-anchor"
            style={{ left: `${view.anchor.position.x}%`, top: `${view.anchor.position.y}%` }}
            className="absolute z-10 w-[10rem] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-primary/35 bg-background/90 px-4 py-3 text-center shadow-[0_20px_42px_-30px_rgba(0,0,0,.8)]"
          >
            <span className="mx-auto flex size-7 items-center justify-center rounded-full border border-primary/45 bg-primary/10"><span className="size-2 rounded-full bg-primary" /></span>
            <span className="mt-2 block text-xs font-semibold text-foreground">{view.anchor.label}</span>
            <span className="mt-1 block text-[10px] text-foreground/55">{view.anchor.detail}</span>
          </div>
        )}

        {contexts.map((context) => (
          <ContextNode key={context.node.id} context={context} selected={context.node.id === selectedId} muted={!!focus && focus.remote.some((item) => item.node.id === context.node.id)} onSelect={() => onSelectNode(context.node.id)} />
        ))}

        {view.recommendation && (
          <button
            type="button"
            onClick={onPrimaryAction}
            data-testid="twin-recommended-action"
            className="absolute bottom-4 left-1/2 z-20 flex w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/35 bg-background/92 px-3.5 py-3 text-left shadow-[0_18px_34px_-28px_rgba(0,0,0,.8)] transition-colors hover:bg-background"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">{view.recommendation.title}</span>
              <span className="mt-0.5 block truncate text-[10px] text-foreground/55">Acción recomendada{view.recommendation.nextStep ? ` · ${view.recommendation.nextStep}` : ''}</span>
            </span>
          </button>
        )}
      </div>

      <div data-testid="twin-context-rail" className="flex flex-wrap items-center justify-between gap-4 border-t border-foreground/10 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          {selected ? (
            <>
              <p className="text-sm font-semibold text-foreground">{selected.node.label}</p>
              <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-foreground/60">{selected.node.summary ?? `Novo está usando este ${ROLE_LABELS[selected.role].toLocaleLowerCase()} para entender qué afecta el siguiente paso.`}</p>
              <p className="mt-2 text-[11px] text-foreground/48">{ROLE_LABELS[selected.role]} · Basado en {selected.node.evidenceIds.length || 'señales'} {selected.node.evidenceIds.length === 1 ? 'evidencia' : 'evidencias'}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Lo que Novo está atendiendo ahora</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/60">{view.dominantContexts.length} contextos relevantes{view.collapsedCount ? ` · ${view.collapsedCount} relacionados permanecen agrupados` : ''}. Selecciona uno para entender qué lo respalda y qué cambia.</p>
            </>
          )}
        </div>
        {selected && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={onWhy} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background transition-transform hover:-translate-y-px"><FileText className="size-3.5" /> Why</button>
            <button type="button" onClick={onInspect} className="inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground/72 transition-colors hover:bg-foreground/[0.05]"><Search className="size-3.5" /> Inspect</button>
          </div>
        )}
      </div>
    </section>
  )
}
