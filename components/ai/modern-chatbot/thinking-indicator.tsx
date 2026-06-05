'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Brain, Search, Lightbulb, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingIndicatorProps {
    status: string | null;
}

const steps = [
    { id: 'thinking', label: 'Pensando...', icon: Brain, color: 'text-primary' },
    { id: 'searching', label: 'Buscando en la web...', icon: Search, color: 'text-primary' },
    { id: 'analyzing', label: 'Analizando información...', icon: Lightbulb, color: 'text-primary' },
    { id: 'creating', label: 'Generando respuesta...', icon: PenTool, color: 'text-green-400' },
];

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
    const [currentStep, setCurrentStep] = useState(0);

    // Map status string to step index or default to cycling
    useEffect(() => {
        if (!status) return;

        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('search') || lowerStatus.includes('buscando')) {
            setCurrentStep(1);
        } else if (lowerStatus.includes('analyz') || lowerStatus.includes('analizando')) {
            setCurrentStep(2);
        } else if (lowerStatus.includes('creat') || lowerStatus.includes('generando') || lowerStatus.includes('escribiendo')) {
            setCurrentStep(3);
        } else {
            setCurrentStep(0);
        }
    }, [status]);

    const activeStep = steps[currentStep];
    const Icon = activeStep.icon;

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full blur animate-pulse opacity-50" />
                <div className="relative bg-background/80 backdrop-blur-sm border border-white/10 rounded-full p-2 shadow-lg">
                    <Icon className={`w-4 h-4 ${activeStep.color} animate-pulse`} />
                </div>
            </div>

            <div className="flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={activeStep.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60"
                    >
                        {status || activeStep.label}
                    </motion.span>
                </AnimatePresence>
                <div className="flex gap-1 mt-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-1 h-1 rounded-full bg-white/40"
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.4, 1, 0.4],
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
