'use client';

import React from 'react';
import { Brain, ArrowRight, AlertTriangle, Zap, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useCognitiveEngine } from '@/hooks/use-swr';
import { useTranslation } from '@/lib/i18n';

interface WidgetData {
  focusScore: number;
  energyLevel: string;
  burnoutRisk: number;
  topInsight: string;
  recommendation: string;
}

const WIDGET_COPY = {
  en: {
    engine: 'Cognitive engine',
    report: 'Performance report',
    focus: 'Focus score',
    operationalLoad: 'Estimated operational load',
    now: 'Now',
    offline: 'Engine offline · Check connection',
    open: 'Open full report',
    risk: { critical: 'high', warning: 'elevated', safe: 'low' },
  },
  es: {
    engine: 'Motor cognitivo',
    report: 'Informe de rendimiento',
    focus: 'Puntuación de foco',
    operationalLoad: 'Carga operativa estimada',
    now: 'Ahora',
    offline: 'Motor sin conexión · Revisa tu conexión',
    open: 'Abrir informe completo',
    risk: { critical: 'alta', warning: 'elevada', safe: 'baja' },
  },
  fr: {
    engine: 'Moteur cognitif',
    report: 'Rapport de performance',
    focus: 'Score de concentration',
    operationalLoad: 'Charge opérationnelle estimée',
    now: 'Maintenant',
    offline: 'Moteur hors ligne · Vérifiez la connexion',
    open: 'Ouvrir le rapport complet',
    risk: { critical: 'élevée', warning: 'modérée', safe: 'faible' },
  },
  de: {
    engine: 'Kognitive Engine',
    report: 'Leistungsbericht',
    focus: 'Fokuswert',
    operationalLoad: 'Geschätzte operative Last',
    now: 'Jetzt',
    offline: 'Engine offline · Verbindung prüfen',
    open: 'Vollständigen Bericht öffnen',
    risk: { critical: 'hoch', warning: 'erhöht', safe: 'niedrig' },
  },
} as const;

function ScoreMini({ score, color }: { score: number; color: string }) {
  const radius = 21;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="-rotate-90 flex-shrink-0">
      <circle cx="29" cy="29" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
      <circle
        cx="29" cy="29" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function CognitiveEngineWidget() {
  // Shared key (hooks/use-swr.ts) — NowHero reads the same endpoint on the
  // same dashboard render; SWR's dedupingInterval collapses both into one
  // request instead of two independent calls to an LLM-backed route.
  const { data: json, isLoading: loading } = useCognitiveEngine();
  const { language } = useTranslation();
  const copy = WIDGET_COPY[language as keyof typeof WIDGET_COPY] ?? WIDGET_COPY.en;
  const data: WidgetData | null = json?.success
    ? {
        focusScore: json.report.focusScore,
        energyLevel: json.report.energyLevel,
        burnoutRisk: json.report.burnoutRisk,
        topInsight: json.report.insights?.[0]?.headline ?? 'Analysis complete',
        recommendation: json.report.recommendation,
      }
    : null;

  const scoreColor = data
    ? data.focusScore >= 70 ? '#22c55e' : data.focusScore >= 40 ? '#f59e0b' : '#ef4444'
    : '#6366f1';

  const riskLevel = data
    ? data.burnoutRisk >= 70 ? 'critical' : data.burnoutRisk >= 50 ? 'warning' : 'safe'
    : 'safe';

  return (
    <Link href="/cognitive" className="block group">
      <div
        className={cn(
          'cognitive-engine-summary glass-surface relative isolate overflow-hidden rounded-3xl border p-5 cursor-pointer',
          'border-foreground/[0.09]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_18px_46px_-34px_rgba(0,0,0,0.72)]',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            background: `radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--primary) 11%, transparent), transparent 42%), radial-gradient(circle at 0% 100%, ${scoreColor}0f, transparent 32%)`,
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 transition-[border-color,background-color] duration-200 group-hover:border-primary/45 group-hover:bg-primary/15"
            >
              <Brain className="w-4 h-4 text-primary" strokeWidth={1.7} />
            </div>
            <div>
              <p className="text-[9px] font-black tracking-[0.25em] uppercase text-foreground/45">{copy.engine}</p>
              <p className="text-xs font-bold text-foreground/75">{copy.report}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-foreground/30 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-primary" strokeWidth={1.8} />
        </div>

        {/* Body */}
        <div className="relative z-10">
          {loading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full animate-pulse flex-shrink-0 border border-foreground/[0.04]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: 'rgba(255,255,255,0.03)' }} />
                <div className="h-2 rounded-full animate-pulse w-1/2" style={{ background: 'rgba(255,255,255,0.02)' }} />
              </div>
            </div>
          ) : data ? (
            <>
              {/* Score + insight */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <ScoreMini score={data.focusScore} color={scoreColor} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                    <span
                      className="text-[13px] font-black tabular-nums leading-none"
                      style={{ color: scoreColor }}
                    >
                      {data.focusScore}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-1">{copy.focus}</p>
                  <p className="text-sm font-bold text-foreground/75 leading-snug truncate">{data.topInsight}</p>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    {riskLevel !== 'safe' && (
                      <AlertTriangle className={cn('w-3 h-3', riskLevel === 'critical' ? 'text-red-400' : 'text-amber-400')} />
                    )}
                    {riskLevel === 'safe' && <Zap className="w-3 h-3 text-green-400" />}
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest',
                      riskLevel === 'critical' ? 'text-red-400' : riskLevel === 'warning' ? 'text-amber-400' : 'text-green-400'
                    )}>
                      {copy.operationalLoad} {copy.risk[riskLevel]} · {data.burnoutRisk}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendation glass pill */}
              <div
                className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.018] px-3.5 py-2.5 transition-colors duration-200 group-hover:border-foreground/[0.12]"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                }}
              >
                <p className="text-[9px] font-black tracking-widest uppercase text-primary/55 mb-0.5 group-hover:text-primary/75 transition-colors">{copy.now} →</p>
                <p className="text-[11px] text-foreground/55 leading-relaxed line-clamp-2">{data.recommendation}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 text-foreground/20">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">{copy.offline}</span>
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div className="flex items-center justify-end mt-3 relative z-10">
          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-primary/30 group-hover:text-primary/60 transition-colors duration-300">
            {copy.open} →
          </span>
        </div>
      </div>
    </Link>
  );
}
