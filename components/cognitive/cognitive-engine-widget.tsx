'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, ArrowRight, AlertTriangle, Zap, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface WidgetData {
  focusScore: number;
  energyLevel: string;
  burnoutRisk: number;
  topInsight: string;
  recommendation: string;
}

function ScoreMini({ score, color }: { score: number; color: string }) {
  const radius = 21;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="-rotate-90 flex-shrink-0">
      <circle cx="29" cy="29" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
      <motion.circle
        cx="29" cy="29" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

export function CognitiveEngineWidget() {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/cognitive-engine')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setData({
            focusScore: json.report.focusScore,
            energyLevel: json.report.energyLevel,
            burnoutRisk: json.report.burnoutRisk,
            topInsight: json.report.insights?.[0]?.headline ?? 'Analysis complete',
            recommendation: json.report.recommendation,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scoreColor = data
    ? data.focusScore >= 70 ? '#22c55e' : data.focusScore >= 40 ? '#f59e0b' : '#ef4444'
    : '#6366f1';

  const riskLevel = data
    ? data.burnoutRisk >= 70 ? 'critical' : data.burnoutRisk >= 50 ? 'warning' : 'safe'
    : 'safe';

  return (
    <Link href="/cognitive" className="block group">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ scale: 1.015, y: -2 }}
        className={cn(
          'relative overflow-hidden rounded-3xl p-5 border transition-all duration-500 cursor-pointer',
          'border-white/[0.08] bg-white/[0.01] backdrop-blur-xl',
          'hover:border-primary/30 hover:bg-primary/[0.02]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.3)]',
          'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_60px_rgba(99,102,241,0.2)]',
        )}
      >
        {/* Ambient gradient orb — shifts on hover via CSS */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 blur-3xl transition-all duration-700 group-hover:opacity-25 group-hover:scale-125 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />

        {/* Secondary warm orb */}
        <div
          className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5 blur-2xl transition-all duration-700 group-hover:opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${scoreColor} 0%, transparent 70%)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl border border-primary/25 flex items-center justify-center transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              style={{ background: 'rgba(99,102,241,0.1)' }}
            >
              <Brain className="w-4 h-4 text-primary transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div>
              <p className="text-[9px] font-black tracking-[0.25em] uppercase text-white/35">Cognitive Engine</p>
              <p className="text-xs font-bold text-white/70">Performance Report</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
        </div>

        {/* Body */}
        <div className="relative z-10">
          {loading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full animate-pulse flex-shrink-0 border border-white/[0.04]"
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
                      style={{ color: scoreColor, textShadow: `0 0 12px ${scoreColor}80` }}
                    >
                      {data.focusScore}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">Focus Score</p>
                  <p className="text-sm font-bold text-white/75 leading-snug truncate">{data.topInsight}</p>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    {riskLevel !== 'safe' && (
                      <AlertTriangle className={cn('w-3 h-3', riskLevel === 'critical' ? 'text-red-400' : 'text-amber-400')} />
                    )}
                    {riskLevel === 'safe' && <Zap className="w-3 h-3 text-green-400" />}
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest',
                      riskLevel === 'critical' ? 'text-red-400' : riskLevel === 'warning' ? 'text-amber-400' : 'text-green-400'
                    )}>
                      Burnout {riskLevel} · {data.burnoutRisk}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendation glass pill */}
              <div
                className="px-3.5 py-2.5 rounded-xl border border-white/[0.06] transition-all duration-300 group-hover:border-white/[0.10]"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                }}
              >
                <p className="text-[9px] font-black tracking-widest uppercase text-primary/45 mb-0.5 group-hover:text-primary/70 transition-colors">Now →</p>
                <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{data.recommendation}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 text-white/20">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">Engine offline · Check connection</span>
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div className="flex items-center justify-end mt-3 relative z-10">
          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-primary/30 group-hover:text-primary/60 transition-colors duration-300">
            Open Full Report →
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
