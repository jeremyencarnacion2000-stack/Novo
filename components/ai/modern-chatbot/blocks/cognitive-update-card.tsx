'use client';

import React from 'react';
import { Brain, Zap, AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface CognitiveUpdateCardProps {
  content: {
    focusScore?: number;
    fatigueEstimate?: string;
    burnoutRisk?: number;
    energyLevel?: string;
    recommendation?: string;
    updatedFields?: string[];
  };
}

export function CognitiveUpdateCard({ content }: CognitiveUpdateCardProps) {
  const focusScore = content.focusScore ?? null;
  const burnoutRisk = content.burnoutRisk ?? null;
  const hasCapacityEstimate = Boolean(content.fatigueEstimate || content.energyLevel);
  const fatigueLevel = content.fatigueEstimate || content.energyLevel;

  const scoreColor = focusScore === null ? '#a3a3a3' : focusScore >= 70 ? '#22c55e' : focusScore >= 40 ? '#f59e0b' : '#ef4444';
  const riskColor = burnoutRisk === null ? '#a3a3a3' : burnoutRisk >= 70 ? '#ef4444' : burnoutRisk >= 50 ? '#f59e0b' : '#22c55e';

  return (
    <div className="my-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/[0.04] to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
        <p className="text-[10px] font-black tracking-[0.2em] uppercase text-primary/60">Estado operativo actualizado</p>
          <p className="text-[11px] text-white/50">Estimaciones de planificación actualizadas</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
        {/* Focus Score */}
        <div className="bg-[#0a0a0c] p-3.5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            {focusScore !== null && focusScore >= 50 ? <TrendingUp className="w-3 h-3" style={{ color: scoreColor }} /> : <TrendingDown className="w-3 h-3" style={{ color: scoreColor }} />}
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Foco</span>
          </div>
          <span className="text-xl font-black tabular-nums" style={{ color: scoreColor, textShadow: `0 0 12px ${scoreColor}40` }}>
            {focusScore ?? 'Sin datos'}
          </span>
        </div>

        {/* Burnout Risk */}
        <div className="bg-[#0a0a0c] p-3.5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" style={{ color: riskColor }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Carga</span>
          </div>
          <span className="text-xl font-black tabular-nums" style={{ color: riskColor }}>
            {burnoutRisk === null ? 'Sin datos' : `${burnoutRisk}%`}
          </span>
        </div>

        {/* Fatigue */}
        <div className="bg-[#0a0a0c] p-3.5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Capacidad estimada</span>
          </div>
          <span className="text-sm font-black capitalize text-amber-400">{hasCapacityEstimate ? fatigueLevel : 'Sin datos'}</span>
        </div>
      </div>

      {/* Recommendation */}
      {content.recommendation && (
        <div className="px-4 py-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/50">Siguiente acción</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">{content.recommendation}</p>
        </div>
      )}

      {/* Updated Fields */}
      {content.updatedFields && content.updatedFields.length > 0 && (
        <div className="px-4 py-2 border-t border-white/[0.04] flex flex-wrap gap-1.5">
          {content.updatedFields.map((field, i) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary/70 font-medium">
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
