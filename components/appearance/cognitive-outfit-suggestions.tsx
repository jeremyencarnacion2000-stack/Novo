'use client';

import React, { useState, useEffect } from 'react';
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

  const fetchCognitiveState = () => {
    fetch('/api/ai/cognitive-engine')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          // Check if there are active insights or recommendations
          const reports = json.report;
          
          // Fallback based on fatigue level if AI recommendation is missing
          let outfit = "Traje casual relajado: Suéter de punto suave, pantalones de lino sueltos y zapatillas deportivas.";
          let psychology = "Colores cálidos y texturas suaves para calmar el sistema nervioso central y reducir el estrés.";

          if (reports.focusScore >= 75) {
            outfit = "Minimalista estructurado: Camisa Oxford blanca de corte limpio, pantalones chinos marinos y zapatos Derby de cuero.";
            psychology = "Líneas definidas y contrastes nítidos para maximizar el enfoque mental y proyectar autoridad.";
          } else if (reports.energyLevel === 'medium') {
            outfit = "Smart casual cómodo: Polo de punto de seda de manga larga, vaqueros oscuros de corte clásico y mocasines de ante.";
            psychology = "Un equilibrio perfecto entre profesionalismo y comodidad que facilita las transiciones cognitivas.";
          }

          setCognitive({
            fatigueEstimate: reports.energyLevel === 'low' ? 'high' : reports.energyLevel === 'high' ? 'low' : 'medium',
            focusScore: reports.focusScore,
            burnoutRisk: reports.burnoutRisk,
            recommendation: {
              outfit,
              psychology
            }
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCognitiveState();
    
    // Listen to voice state updates to sync automatically!
    window.addEventListener('cognitive-state-updated', fetchCognitiveState);
    return () => window.removeEventListener('cognitive-state-updated', fetchCognitiveState);
  }, []);

  if (loading) {
    return (
      <Card className="border-white/[0.08] bg-white/[0.01] backdrop-blur-xl animate-pulse">
        <div className="h-48 rounded-3xl" />
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
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm">
          <Cpu className="w-5 h-5 text-primary animate-pulse" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Cognitive State Sync</p>
            <p className="text-xs text-white/80 font-bold">
              Focus Score: <span className="text-primary">{cognitive?.focusScore}/100</span> · Fatigue Level: <span className="capitalize">{cognitive?.fatigueEstimate}</span>
            </p>
          </div>
        </div>

        {/* Outfit suggestion card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3.5 relative"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Recomendación de Vestuario</h4>
          </div>

          <p className="text-sm font-semibold text-white/95 leading-relaxed">
            {cognitive?.recommendation?.outfit}
          </p>

          <div className="pt-2.5 border-t border-white/[0.04] space-y-1">
            <div className="flex items-center gap-1.5 text-white/40">
              <Heart className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest">Psicología de Estilo</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {cognitive?.recommendation?.psychology}
            </p>
          </div>
        </motion.div>

        {/* Tips list */}
        <div className="space-y-2.5">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-white/20">System Principles</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-white/60">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.01] border border-white/[0.04]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Zapatillas cómodas para reducir fatiga física.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.01] border border-white/[0.04]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Materiales orgánicos transpirables (lino, lana, algodón).</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
