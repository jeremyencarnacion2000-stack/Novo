'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Sparkles, LayoutDashboard, Music, ArrowRight, CheckCircle2, Brain, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

const slides = [
    {
        tag: "Welcome",
        title: "Novo",
        subtitle: "Your Productivity\nSanctuary",
        description: "A minimalist space to organize tasks, projects, and routines — all in one place.",
        icon: LayoutDashboard,
        features: [
            { icon: CheckCircle2, text: "Smart task management" },
            { icon: Timer, text: "Routine & habit tracking" },
        ],
        gradient: "from-violet-600/30 via-purple-500/10 to-transparent",
        accent: "violet",
    },
    {
        tag: "Intelligence",
        title: "AI Synergy",
        subtitle: "Your Intelligent\nPartner",
        description: "An AI assistant that understands your workflow and helps you stay focused.",
        icon: Sparkles,
        features: [
            { icon: Brain, text: "Context-aware assistance" },
            { icon: Sparkles, text: "Smart suggestions" },
        ],
        gradient: "from-blue-600/30 via-cyan-500/10 to-transparent",
        accent: "blue",
    },
    {
        tag: "Focus",
        title: "Deep Flow",
        subtitle: "Rhythm in\nMotion",
        description: "YouTube Music integration and focus timers work together to keep you in flow state.",
        icon: Music,
        features: [
            { icon: Music, text: "Integrated music player" },
            { icon: Timer, text: "Pomodoro focus timer" },
        ],
        gradient: "from-emerald-600/30 via-teal-500/10 to-transparent",
        accent: "emerald",
    }
]

export function WelcomeCarousel() {
    const [current, setCurrent] = useState(0)

    const nextSlide = () => {
        if (current < slides.length - 1) {
            setCurrent(current + 1)
        }
    }

    const goToSignIn = () => {
        // Use window.location for reliable navigation in Capacitor WebView
        window.location.href = '/auth/signin'
    }

    const slide = slides[current]

    return (
        <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col">
            {/* Background Gradient */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`bg-${current}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className={cn("absolute inset-0 bg-gradient-to-b", slide.gradient)}
                />
            </AnimatePresence>

            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }} />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
                        <div className="h-3 w-3 bg-black rounded-full" />
                    </div>
                    <span className="text-base font-bold tracking-tight text-white">NOVO</span>
                </div>
                <button
                    onClick={goToSignIn}
                    className="text-white/40 text-xs font-medium tracking-wider uppercase hover:text-white/70 transition-colors"
                >
                    Skip
                </button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-8 pb-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`content-${current}`}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as any }}
                        className="space-y-8"
                    >
                        {/* Tag */}
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "h-6 w-6 rounded-lg flex items-center justify-center",
                                slide.accent === 'violet' && "bg-violet-500/20",
                                slide.accent === 'blue' && "bg-blue-500/20",
                                slide.accent === 'emerald' && "bg-emerald-500/20",
                            )}>
                                {React.createElement(slide.icon, {
                                    className: cn(
                                        "h-3.5 w-3.5",
                                        slide.accent === 'violet' && "text-violet-400",
                                        slide.accent === 'blue' && "text-blue-400",
                                        slide.accent === 'emerald' && "text-emerald-400",
                                    )
                                })}
                            </div>
                            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/40">
                                {slide.tag}
                            </span>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-[1.1] whitespace-pre-line">
                                {slide.subtitle}
                            </h1>
                        </div>

                        {/* Description */}
                        <p className="text-base text-white/50 leading-relaxed max-w-sm">
                            {slide.description}
                        </p>

                        {/* Feature Pills */}
                        <div className="flex flex-col gap-3 pt-2">
                            {slide.features.map((feat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        {React.createElement(feat.icon, { className: "h-4 w-4 text-white/40" })}
                                    </div>
                                    <span className="text-sm text-white/60 font-medium">{feat.text}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Navigation */}
            <div className="relative z-10 px-8 pb-12 space-y-6">
                {/* Progress Dots — WCAG 2.1 compliant touch targets via invisible padding */}
                <div className="flex gap-2 items-center">
                    {slides.map((_, i) => (
                        <span key={i} className="relative flex items-center justify-center">
                            <button
                                onClick={() => setCurrent(i)}
                                aria-label={`Go to slide ${i + 1}`}
                                aria-current={i === current ? 'true' : undefined}
                                className={cn(
                                    "relative h-1 rounded-full transition-all duration-500",
                                    "before:content-[''] before:absolute before:-inset-y-[22px] before:-inset-x-[12px]",
                                    i === current ? "w-10 bg-white" : "w-2 bg-white/15"
                                )}
                            />
                        </span>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                    {current < slides.length - 1 ? (
                        <button
                            onClick={nextSlide}
                            className="h-14 px-8 rounded-2xl bg-white text-black font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
                        >
                            Continue
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            onClick={goToSignIn}
                            className="h-14 px-8 rounded-2xl bg-white text-black font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-white/10"
                        >
                            Get Started
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
