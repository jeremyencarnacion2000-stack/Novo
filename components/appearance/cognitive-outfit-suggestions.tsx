'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Shirt, ShieldAlert, Cpu, Heart, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface CognitiveState {
  fatigueEstimate: string;
  focusScore: number;
  burnoutRisk: number;
  recommendation?: {
    outfit?: string;
    psychology?: string;
  };
}

export function CognitiveOutfitSuggestions() {
  const [cognitive, setCognitive] = useState<CognitiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  const fetchCognitiveState = useCallback(() => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setError(false);

    fetch('/api/ai/cognitive-engine', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('cognitive_state_unavailable');
        const json = await response.json();
        const reports = json?.success ? json.report : null;
        const focusScore = Number(reports?.focusScore);
        const burnoutRisk = Number(reports?.burnoutRisk);
        const energyLevel = reports?.energyLevel;
        if (!Number.isFinite(focusScore) || !Number.isFinite(burnoutRisk) || !['low', 'medium', 'high'].includes(energyLevel)) {
          throw new Error('cognitive_state_invalid');
        }

        let outfit = "Traje casual relajado: Suéter de punto suave, pantalones de lino sueltos y zapatillas deportivas.";
        let psychology = "Colores cálidos y texturas suaves para calmar el sistema nervioso central y reducir el estrés.";

        if (focusScore >= 75) {
          outfit = "Minimalista estructurado: Camisa Oxford blanca de corte limpio, pantalones chinos marinos y zapatos Derby de cuero.";
          psychology = "Líneas definidas y contrastes nítidos para maximizar el enfoque mental y proyectar autoridad.";
        } else if (energyLevel === 'medium') {
          outfit = "Smart casual cómodo: Polo de punto de seda de manga larga, vaqueros oscuros de corte clásico y mocasines de ante.";
          psychology = "Un equilibrio perfecto entre profesionalismo y comodidad que facilita las transiciones cognitivas.";
        }

        setCognitive({
          fatigueEstimate: energyLevel === 'low' ? 'high' : energyLevel === 'high' ? 'low' : 'medium',
          focusScore: Math.max(0, Math.min(100, focusScore)),
          burnoutRisk: Math.max(0, Math.min(100, burnoutRisk)),
          recommendation: { outfit, psychology },
        });
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchCognitiveState();
    
    // Listen to voice state updates to sync automatically!
    window.addEventListener('cognitive-state-updated', fetchCognitiveState);
    return () => {
      window.removeEventListener('cognitive-state-updated', fetchCognitiveState);
      requestControllerRef.current?.abort();
    };
  }, [fetchCognitiveState]);

  if (loading) {
    return (
      <Card className="border-foreground/[0.08] bg-foreground/[0.01] backdrop-blur-xl animate-pulse">
        <div className="h-48 rounded-3xl" />
      </Card>
    );
  }

  if (error && !cognitive) {
    return (
      <Card className="border-foreground/[0.08] bg-foreground/[0.01]">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <p className="text-sm font-semibold">Cognitive state unavailable</p>
          <p className="max-w-sm text-xs text-foreground/50">We could not refresh your focus context. Try again when your session is active.</p>
          <button type="button" onClick={fetchCognitiveState} className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10">
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const isFatigued = cognitive?.fatigueEstimate === 'high' || cognitive?.fatigueEstimate === 'critical';

  return (
    <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-background to-primary/5 shadow-2xl relative">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-5 blur-2xl bg-primary" />
      
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center">
              <Shirt className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Cognitive Dress Code</CardTitle>
              <CardDescription>Outfit suggestions based on your fatigue & focus metrics</CardDescription>
            </div>
          </div>
          <Badge variant={isFatigued ? "destructive" : "secondary"} className="uppercase tracking-widest text-[9px] font-black px-2 py-0.5">
            {isFatigued ? "Low Friction Outfit Required" : "High Focus Outfit Suggestion"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 relative z-10">
        {/* State Banner */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.01] backdrop-blur-sm">
          <Cpu className="w-5 h-5 text-primary animate-pulse" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Cognitive State Sync</p>
            <p className="text-xs text-foreground/80 font-bold">
              Focus Score: <span className="text-primary">{cognitive?.focusScore}/100</span> · Fatigue Level: <span className="capitalize">{cognitive?.fatigueEstimate}</span>
            </p>
          </div>
        </div>

        {/* Outfit suggestion card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] space-y-3.5 relative"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Recomendación de Vestuario</h4>
          </div>

          <p className="text-sm font-semibold text-foreground/95 leading-relaxed">
            {cognitive?.recommendation?.outfit}
          </p>

          <div className="pt-2.5 border-t border-foreground/[0.04] space-y-1">
            <div className="flex items-center gap-1.5 text-foreground/40">
              <Heart className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest">Psicología de Estilo</span>
            </div>
            <p className="text-xs text-foreground/50 leading-relaxed">
              {cognitive?.recommendation?.psychology}
            </p>
          </div>
        </motion.div>

        {/* Tips list */}
        <div className="space-y-2.5">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-foreground/20">System Principles</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-foreground/60">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-foreground/[0.01] border border-foreground/[0.04]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Zapatillas cómodas para reducir fatiga física.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-foreground/[0.01] border border-foreground/[0.04]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Materiales orgánicos transpirables (lino, lana, algodón).</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
