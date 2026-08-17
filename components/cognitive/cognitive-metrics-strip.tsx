'use client'

import { Activity, Brain } from 'lucide-react'
import { useSWRWithConfig } from '@/hooks/use-swr'
import { NovoLineChart } from '@/components/charts/line-chart'

interface HistoryPoint { date: string; cognitiveLoad: number; confidence: number }
type MetricKey = 'cognitiveLoad' | 'confidence'
interface MetricDef { key: MetricKey; label: string; icon: React.ElementType; accent: string; current: number | null; higherIsBetter: boolean; classification: string }

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const width = 100, height = 32, min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const points = values.map((value, index) => `${(index * width / (values.length - 1)).toFixed(1)},${(height - ((value - min) / range) * (height - 4) - 2).toFixed(1)}`)
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true"><polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={color} fillOpacity={0.1} /><polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
}

function MetricCard({ def, history }: { def: MetricDef; history: HistoryPoint[] }) {
  const Icon = def.icon
  const values = history.map((point) => point[def.key]).filter((value) => Number.isFinite(value))
  const hasTrend = values.length >= 2
  const delta = hasTrend ? values[values.length - 1] - values[0] : null
  const deltaGood = delta != null && (def.higherIsBetter ? delta >= 0 : delta <= 0)
  const calibrated = typeof def.current === 'number' && def.current > 0
  return <div className="card--secondary liquid-glass flex flex-col gap-3 rounded-2xl p-4 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]"><div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/40"><Icon className="size-3.5" style={{ color: def.accent }} />{def.label}</span>{delta != null && delta !== 0 && <span className={`text-[10px] font-bold ${deltaGood ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{delta > 0 ? '+' : ''}{delta}</span>}</div><div className="flex items-end gap-1"><span className="text-2xl font-black leading-none text-foreground/90">{calibrated ? def.current : '—'}</span>{calibrated && <span className="mb-0.5 text-xs font-semibold text-foreground/30">%</span>}</div><p className="-mt-1 text-[9px] font-medium text-foreground/40">{def.classification}</p>{hasTrend ? <Sparkline values={values} color={def.accent} /> : <div className="flex h-8 items-center"><span className="text-[9px] italic text-foreground/35">Construyendo historial con datos propios</span></div>}</div>
}

export function CognitiveMetricsStrip({ cognitiveLoad, confidence }: { cognitiveLoad: number | null; confidence: number | null }) {
  const { data } = useSWRWithConfig<{ history?: HistoryPoint[] }>('/api/cognitive/metrics-history')
  const history = data?.history ?? []
  const metrics: MetricDef[] = [
    { key: 'cognitiveLoad', label: 'Carga estimada', icon: Brain, accent: '#fbbf24', current: cognitiveLoad, higherIsBetter: false, classification: 'Estimación determinista' },
    { key: 'confidence', label: 'Confianza del Twin', icon: Activity, accent: '#b7f3d0', current: confidence, higherIsBetter: true, classification: confidence && confidence > 0 ? 'Basada en señales observadas' : 'Sin calibrar' },
  ]
  return <div>
    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30">Indicadores operativos · Tendencia</p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{metrics.map((def) => <MetricCard key={def.key} def={def} history={history} />)}</div>
    {history.length >= 2 && (
      <div className="cognitive-chart novo-premium-field mt-4 overflow-hidden rounded-3xl border border-foreground/[0.08] p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/65">Ritmo operativo</p><p className="mt-1 text-[10px] text-foreground/38">Señales registradas por Novo</p></div><Activity className="size-4 text-primary/70" aria-hidden="true" /></div>
        <NovoLineChart data={history} />
        <div className="mt-2 flex items-center justify-end gap-3 text-[9px] font-semibold text-foreground/42"><span className="inline-flex items-center gap-1"><i className="size-1.5 rounded-full bg-amber-300" />Carga</span><span className="inline-flex items-center gap-1"><i className="size-1.5 rounded-full bg-[#b7f3d0]" />Confianza</span></div>
      </div>
    )}
  </div>
}
