'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMagneticEffect } from '@/hooks/use-magnetic-effect';

interface VoiceAssistantButtonProps {
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'indigo';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showText?: boolean;
}

export function VoiceAssistantButton({
    className = '',
    variant = 'indigo',
    size = 'default',
    showText = true
}: VoiceAssistantButtonProps) {
    const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking' | 'thinking' | 'connecting' | 'error'>('idle');

    // Sync state with central VoiceCommandHub
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleStateChange = (e: any) => {
                const state = e.detail?.state || 'idle';
                setVoiceState(state);
            };
            window.addEventListener('voice-command-hub-state-change', handleStateChange);
            return () => {
                window.removeEventListener('voice-command-hub-state-change', handleStateChange);
            };
        }
    }, []);

    // Co-navigation smooth scrolling when voice agent is processing or speaking
    useEffect(() => {
        if (voiceState === 'speaking' || voiceState === 'thinking') {
            const modules = ['calendar-container', 'trackers-container', 'checklist-container'];
            for (const modId of modules) {
                const el = document.getElementById(modId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        }
    }, [voiceState]);

    // Apply high-end useMagneticEffect with proximity boundary of 75px
    const { ref: magneticRef, x, y } = useMagneticEffect(75, 0.35);

    const toggleListening = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('toggle-voice-command-hub'));
        }
    };

    const isListening = voiceState === 'listening';
    const isSpeaking = voiceState === 'speaking';
    const isThinking = voiceState === 'thinking';
    const isConnecting = voiceState === 'connecting';
    const isLoading = isConnecting || isThinking;

    // Elastic Button Spring Config: stiffness: 350, damping: 25, mass: 0.5 (fast & crisp)
    const elasticTransition = {
        type: 'spring',
        stiffness: 350,
        damping: 25,
        mass: 0.5
    };

    // Styling overrides
    const sizeClasses = {
        default: 'px-5 py-2.5 text-sm h-11',
        sm: 'px-3.5 py-2 text-xs h-9',
        lg: 'px-6 py-3 text-base h-13',
        icon: 'w-11 h-11'
    };

    const variantClasses = {
        default: 'bg-primary text-white border border-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]',
        outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
        indigo: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_30px_rgba(139,92,246,0.55)] border-none'
    };

    const getStateLabel = () => {
        if (isConnecting) return 'Conectando...';
        if (isThinking) return 'Pensando...';
        if (isListening) return 'Escuchando...';
        if (isSpeaking) return 'Hablando...';
        return 'Comandos de Voz';
    };

    return (
        <div ref={magneticRef} className="inline-block relative">
            <motion.button
                onClick={toggleListening}
                style={{ x, y }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                transition={elasticTransition}
                className={`
                    relative flex items-center justify-center font-medium rounded-full cursor-pointer
                    select-none active:outline-none focus-visible:outline-none transition-shadow
                    disabled:opacity-85 disabled:cursor-not-allowed overflow-hidden will-change-transform
                    ${sizeClasses[size]}
                    ${variantClasses[variant]}
                    ${className}
                `}
            >
                {/* Internal dynamic light shimmer sweep on hover */}
                <span className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

                {/* Ambient breathing aura when listening */}
                <AnimatePresence>
                    {(isListening || isSpeaking) && (
                        <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.2 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none rounded-full"
                        />
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-2 relative z-10">
                    <AnimatePresence mode="wait">
                        {isConnecting ? (
                            <motion.div
                                key="connecting"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                            >
                                <Loader2 className="h-4 w-4" />
                            </motion.div>
                        ) : isThinking ? (
                            <motion.div
                                key="thinking"
                                animate={{ scale: [1, 1.15, 1] }}
                                transition={{ repeat: Infinity, duration: 1.0 }}
                            >
                                <Brain className="h-4 w-4 text-orange-400" />
                            </motion.div>
                        ) : isListening ? (
                            <motion.div
                                key="listening"
                                initial={{ scale: 0.6, rotate: -45, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                exit={{ scale: 0.6, rotate: 45, opacity: 0 }}
                                transition={elasticTransition}
                            >
                                <MicOff className="h-4 w-4 text-white" />
                            </motion.div>
                        ) : isSpeaking ? (
                            <motion.div
                                key="speaking"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 0.6 }}
                            >
                                <Sparkles className="h-4 w-4 text-cyan-300" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="idle"
                                initial={{ scale: 0.6, rotate: 45, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                exit={{ scale: 0.6, rotate: -45, opacity: 0 }}
                                transition={elasticTransition}
                            >
                                <Mic className="h-4 w-4" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {showText && (
                        <motion.span
                            layout
                            transition={elasticTransition}
                            className="font-medium tracking-tight"
                        >
                            {getStateLabel()}
                        </motion.span>
                    )}
                </div>

                {/* High frequency decorative audio visualizer dots when listening */}
                {isListening && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-2">
                        <span className="w-0.75 bg-white/80 rounded-full animate-[bounce_0.6s_infinite_delay-1] h-1" />
                        <span className="w-0.75 bg-white/80 rounded-full animate-[bounce_0.6s_infinite_delay-2] h-2" style={{ animationDelay: '0.15s' }} />
                        <span className="w-0.75 bg-white/80 rounded-full animate-[bounce_0.6s_infinite_delay-3] h-1.5" style={{ animationDelay: '0.3s' }} />
                    </div>
                )}
            </motion.button>

            {/* Micro gravitational radial ring for proximity styling */}
            <div className="absolute inset-[-4px] border border-white/5 rounded-full pointer-events-none scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500" />
        </div>
    );
}
