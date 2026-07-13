'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { GlowingOrb } from './glowing-orb';

const INTENT_LABEL: Record<string, string> = {
    TASK: 'Gestión de tareas',
    ROUTINE: 'Rutinas',
    PROJECT: 'Proyectos',
    SYSTEM_META: 'Sistema',
    COGNITIVE: 'Análisis cognitivo',
    CODE: 'Código',
    DESIGN: 'Diseño',
    VISION: 'Visión',
    GENERAL: 'Conversación general',
};

// Replaces the old thinking-indicator.tsx, which cycled 4 canned labels by
// keyword-matching a client-guessed status string and was never actually
// wired into the app. This version shows only real pipeline stages: the
// classifier/model info comes straight from the `meta` SSE event
// /api/ai/stream already emits (see context.tsx's sendMessage) — nothing
// here is guessed or fabricated client-side.
export function ThinkingSteps({
    modelLabel,
    intent,
    fallback,
}: {
    modelLabel: string | null;
    intent: string | null;
    fallback: boolean;
}) {
    const routeLabel = modelLabel
        ? `Conectado a ${modelLabel}${fallback ? ' (respaldo)' : ''}${intent && INTENT_LABEL[intent] ? ` · ${INTENT_LABEL[intent]}` : ''}`
        : null;

    const steps = [
        { id: 'analyze', label: 'Analizando tu mensaje' },
        ...(routeLabel ? [{ id: 'route', label: routeLabel }] : []),
    ];
    const activeIndex = steps.length - 1;

    return (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
            <GlowingOrb state="thinking" size="sm" />
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-primary animate-pulse" />
                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Procesando</span>
                </div>
                <AnimatePresence mode="popLayout">
                    {steps.map((step, i) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: i === activeIndex ? 1 : 0.4, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === activeIndex ? 'bg-primary animate-pulse' : 'bg-white/30'}`} />
                            <span className="text-xs text-white/70 font-medium">{step.label}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
