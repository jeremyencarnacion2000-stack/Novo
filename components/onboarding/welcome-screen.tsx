'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Sparkles, LayoutDashboard, ArrowRight, CheckCircle2, Brain, ShieldCheck, CalendarDays, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

const WELCOME_COPY = {
    en: {
        skip: 'Sign in', continue: 'Continue', start: 'Start with Novo', slideLabel: 'Go to screen',
        slides: [
            { tag: 'YOUR DAY', subtitle: 'Clarity before\ncomplexity.', description: 'Novo brings your calendar, tasks, and commitments into one calm view so you know what matters now.', icon: LayoutDashboard, features: [{ icon: CalendarDays, text: 'Your real schedule and commitments' }, { icon: CheckCircle2, text: 'A useful first day, not an empty dashboard' }] },
            { tag: 'LEARNS WITH YOU', subtitle: 'Your work becomes\nshared context.', description: 'Connect only the tools you choose. Novo notices patterns over time and shows where every signal came from.', icon: Brain, features: [{ icon: ListChecks, text: 'Calendar, email, and task signals' }, { icon: Sparkles, text: 'Understanding that improves with use' }] },
            { tag: 'YOU STAY IN CONTROL', subtitle: 'One clear\nnext move.', description: 'Novo explains its recommendation and asks before sensitive actions. You can correct it whenever it gets something wrong.', icon: ShieldCheck, features: [{ icon: ShieldCheck, text: 'Explicit permissions and reversible access' }, { icon: CheckCircle2, text: 'Recommendations you can inspect and correct' }] },
        ],
    },
    es: {
        skip: 'Iniciar sesión', continue: 'Continuar', start: 'Comenzar con Novo', slideLabel: 'Ir a la pantalla',
        slides: [
            { tag: 'TU DÍA', subtitle: 'Claridad antes\nde complejidad.', description: 'Novo reúne tu agenda, tareas y compromisos en una vista serena para mostrarte qué importa ahora.', icon: LayoutDashboard, features: [{ icon: CalendarDays, text: 'Tu agenda y compromisos reales' }, { icon: CheckCircle2, text: 'Un primer día útil, no un panel vacío' }] },
            { tag: 'APRENDE CONTIGO', subtitle: 'Tu trabajo se vuelve\ncontexto compartido.', description: 'Conecta solo las herramientas que elijas. Novo aprende patrones con el tiempo y muestra de dónde salió cada señal.', icon: Brain, features: [{ icon: ListChecks, text: 'Señales de agenda, correo y tareas' }, { icon: Sparkles, text: 'Una comprensión que mejora con el uso' }] },
            { tag: 'TÚ TIENES EL CONTROL', subtitle: 'Un siguiente paso\nclaro.', description: 'Novo explica su recomendación y pide permiso antes de actuar. Puedes corregirlo cuando interprete algo mal.', icon: ShieldCheck, features: [{ icon: ShieldCheck, text: 'Permisos explícitos y acceso revocable' }, { icon: CheckCircle2, text: 'Recomendaciones que puedes revisar y corregir' }] },
        ],
    },
    fr: {
        skip: 'Se connecter', continue: 'Continuer', start: 'Commencer avec Novo', slideLabel: 'Aller à l’écran',
        slides: [
            { tag: 'VOTRE JOURNÉE', subtitle: 'La clarté avant\nla complexité.', description: 'Novo réunit votre agenda, vos tâches et vos engagements pour montrer ce qui compte maintenant.', icon: LayoutDashboard, features: [{ icon: CalendarDays, text: 'Votre agenda et vos engagements réels' }, { icon: CheckCircle2, text: 'Une première journée utile' }] },
            { tag: 'APPREND AVEC VOUS', subtitle: 'Votre travail devient\nun contexte partagé.', description: 'Connectez uniquement les outils choisis. Novo apprend avec le temps et cite chaque source.', icon: Brain, features: [{ icon: ListChecks, text: 'Agenda, e-mail et tâches' }, { icon: Sparkles, text: 'Une compréhension qui progresse' }] },
            { tag: 'VOUS GARDEZ LE CONTRÔLE', subtitle: 'Une prochaine étape\nclaire.', description: 'Novo explique ses recommandations et demande votre accord avant toute action sensible.', icon: ShieldCheck, features: [{ icon: ShieldCheck, text: 'Autorisations explicites et révocables' }, { icon: CheckCircle2, text: 'Des recommandations corrigibles' }] },
        ],
    },
    de: {
        skip: 'Anmelden', continue: 'Weiter', start: 'Mit Novo starten', slideLabel: 'Zum Bildschirm',
        slides: [
            { tag: 'DEIN TAG', subtitle: 'Klarheit vor\nKomplexität.', description: 'Novo verbindet Kalender, Aufgaben und Verpflichtungen und zeigt, was jetzt zählt.', icon: LayoutDashboard, features: [{ icon: CalendarDays, text: 'Dein echter Zeitplan' }, { icon: CheckCircle2, text: 'Ein nützlicher erster Tag' }] },
            { tag: 'LERNT MIT DIR', subtitle: 'Deine Arbeit wird\ngemeinsamer Kontext.', description: 'Verbinde nur ausgewählte Werkzeuge. Novo lernt mit der Zeit und nennt jede Quelle.', icon: Brain, features: [{ icon: ListChecks, text: 'Kalender-, E-Mail- und Aufgabensignale' }, { icon: Sparkles, text: 'Verständnis, das sich verbessert' }] },
            { tag: 'DU BEHÄLTST DIE KONTROLLE', subtitle: 'Ein klarer\nnächster Schritt.', description: 'Novo erklärt Empfehlungen und fragt vor sensiblen Aktionen nach deiner Zustimmung.', icon: ShieldCheck, features: [{ icon: ShieldCheck, text: 'Explizite, widerrufbare Berechtigungen' }, { icon: CheckCircle2, text: 'Prüf- und korrigierbare Empfehlungen' }] },
        ],
    },
} as const

export function WelcomeCarousel() {
    const [current, setCurrent] = useState(0)
    const { language } = useTranslation()
    const locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
    const copy = WELCOME_COPY[locale]
    const slides = copy.slides

    const nextSlide = () => {
        if (current < slides.length - 1) {
            setCurrent(current + 1)
        }
    }

    const goToSignIn = () => {
        // Use window.location for reliable navigation in Capacitor WebView
        window.location.href = '/auth/signin?callbackUrl=%2Fonboarding'
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
                    className="absolute inset-0 bg-[radial-gradient(circle_at_35%_15%,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(183,243,208,0.08),transparent_38%)]"
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
                    {copy.skip}
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
                                "bg-emerald-400/15",
                            )}>
                                {React.createElement(slide.icon, {
                                    className: cn(
                                        "h-3.5 w-3.5",
                                        "text-emerald-200",
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
                                aria-label={`${copy.slideLabel} ${i + 1}`}
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
                            {copy.continue}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            onClick={goToSignIn}
                            className="h-14 px-8 rounded-2xl bg-white text-black font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-white/10"
                        >
                            {copy.start}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
