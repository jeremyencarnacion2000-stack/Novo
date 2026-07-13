'use client'

import { useEffect, useState } from 'react'
import { Activity, BatteryCharging, Brain } from 'lucide-react'

// The trend dimension the point-in-time gauges above lack: each card shows the
// CURRENT value (from the cognitive engine, passed in) plus a real sparkline of
// the last N daily TwinSnapshots. No history yet (new user) → honest empty
// state, never a fabricated line.

interface HistoryPoint {
  date: string
  cognitiveLoad: number
  recoveryReserve: number
  confidence: number
}

type MetricKey = 'cognitiveLoad' | 'recoveryReserve' | 'confidence'

interface MetricDef {
  key: MetricKey
  label: string
  icon: React.ElementType
  accent: string // hex for sparkline + glow
  current: number | null
  // higher value = better? drives the up/down delta color
  higherIsBetter: boolean
}

// Tiny hand-rolled sparkline — no chart lib. Normalizes the series into a
// fixed viewBox and draws a polyline + a soft area fill.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 100
  const H = 32
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = W / (values.length - 1)

  const pts = values.map((v, i) => {
    const x = i * step
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = pts.join(' ')
  const area = `0,${H} ${line} ${W},${H}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-8">
      <polygon points={area} fill={color} fillOpacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function MetricCard({ def, history }: { def: MetricDef; history: HistoryPoint[] }) {
  const Icon = def.icon
  const series = history.map((h) => h[def.key])
  const hasTrend = series.length >= 2

  // Delta vs. the start of the visible window — real, from the snapshot series.
  const delta = hasTrend ? series[series.length - 1] - series[0] : null
  const deltaGood = delta != null && (def.higherIsBetter ? delta >= 0 : delta <= 0)

  return (
    <div className="card--secondary liquid-glass rounded-2xl p-4 flex flex-col gap-3 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/40 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: def.accent }} />
          {def.label}
        </span>
        {delta != null && delta !== 0 && (
          <span className={`text-[10px] font-bold ${deltaGood ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>

      <div className="flex items-end gap-1">
        <span className="text-2xl font-black text-foreground/90 leading-none">
          {def.current != null ? def.current : '—'}
        </span>
        <span className="text-xs font-semibold text-foreground/30 mb-0.5">%</span>
      </div>

      {hasTrend ? (
        <Sparkline values={series} color={def.accent} />
      ) : (
        <div className="h-8 flex items-center">
          <span className="text-[9px] text-foreground/25 italic">
            Construyendo historial — usa Novo unos días
          </span>
        </div>
      )}
    </div>
  )
}

export function CognitiveMetricsStrip({
  cognitiveLoad,
  recoveryReserve,
  confidence,
}: {
  cognitiveLoad: number | null
  recoveryReserve: number | null
  confidence: number | null
}) {
  const [history, setHistory] = useState<HistoryPoint[]>([])

  useEffect(() => {
    fetch('/api/cognitive/metrics-history')
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((d) => setHistory(d.history ?? []))
      .catch(() => setHistory([]))
  }, [])

  const metrics: MetricDef[] = [
    { key: 'cognitiveLoad', label: 'Cognitive Load', icon: Brain, accent: '#fbbf24', current: cognitiveLoad, higherIsBetter: false },
    { key: 'recoveryReserve', label: 'Recovery Reserve', icon: BatteryCharging, accent: '#34d399', current: recoveryReserve, higherIsBetter: true },
    { key: 'confidence', label: 'Twin Confidence', icon: Activity, accent: '#818cf8', current: confidence, higherIsBetter: true },
  ]

  return (
    <div>
      <p className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/30 mb-3">Cognitive Metrics · Tendencia</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((def) => (
          <MetricCard key={def.key} def={def} history={history} />
        ))}
      </div>
    </div>
  )
}
