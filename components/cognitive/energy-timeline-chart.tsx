'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Info } from 'lucide-react';
import type { EnergyPoint } from './types';

interface EnergyTimelineChartProps {
  timeline: EnergyPoint[];
  currentHour: number;
  peakStart: number;
  peakEnd: number;
}

/**
 * There is currently no direct energy sensor/check-in series in the product.
 * Do not render the old synthetic circadian curve as if it were a measured
 * metric. This honest empty state keeps the information architecture ready for
 * a real series once enough user observations exist.
 */
export function EnergyTimelineChart(_props: EnergyTimelineChartProps) {
  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.45 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-foreground/80">
            Capacidad estimada
          </h3>
          <p className="mt-0.5 text-[10px] text-foreground/55">Sin medición directa todavía</p>
        </div>
        <Activity className="h-4 w-4 text-foreground/45" aria-hidden="true" />
      </div>
      <div className="flex min-h-36 items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-5">
        <Info className="h-4 w-4 shrink-0 text-primary/75" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-foreground/65">
          Esta vista dejará de mostrar una curva sintética. Registra algunos check-ins de energía para construir una tendencia basada en tus datos, no en una predicción genérica.
        </p>
      </div>
    </motion.div>
  );
}
