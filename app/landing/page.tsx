'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import {
  Brain, Eye, Radar, Compass, Sparkles,
  ArrowRight, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
import { springConfig } from '@/lib/design-tokens'
import { PageTransitionProvider, usePageTransition } from '@/components/landing/page-transition-overlay'

const PIPELINE = [
  { icon: Eye, label: 'Observe', detail: 'Lee señales reales: tareas, foco, rutinas, horarios — no encuestas.' },
  { icon: Brain, label: 'Interpret', detail: 'Construye un modelo de tu energía, atención y patrones de ejecución.' },
  { icon: Radar, label: 'Predict', detail: 'Anticipa cuándo vas a rendir mejor y cuándo necesitas recuperarte.' },
  { icon: Compass, label: 'Guide', detail: 'Te dice qué hacer ahora mismo — no otra lista, una decisión.' },
  { icon: Sparkles, label: 'Learn', detail: 'Cada sesión ajusta el modelo. El Twin nunca deja de aprender.' },
] as const

const DIFFERENTIATORS = [
  {
    title: 'No es otra lista de tareas',
    detail: 'Las apps de productividad organizan objetos. Novo interpreta tu capacidad cognitiva y decide contigo qué ejecutar primero.',
  },
  {
    title: 'Aprende de tu comportamiento real',
    detail: 'Cada tarea completada, cada sesión de foco, cada rutina cumplida entrena tu Twin. Entre más lo usas, mejor te conoce.',
  },
  {
    title: 'Una decisión, no un dashboard',
    detail: 'El objetivo no es mostrarte más datos. Es responder una pregunta: ¿qué deberías hacer ahora mismo?',
  },
] as const

function HeroVisual() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center py-4"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { ...springConfig.gentle, delay: 0.1 }}
    >
      {/* Placeholder visual — no real screenshot/illustration asset available
          yet (see Task 1's status note in the plan). Warm gradient field,
          same mechanism as the indigo glows elsewhere on this page, just
          recolored. Swap for a real product shot when one exists. */}
      <div className="relative w-full max-w-2xl aspect-[16/10] mx-auto rounded-[2rem] overflow-hidden border border-[#F1F5F3]/[0.08] bg-[#0A0C0B]/70 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full opacity-30 blur-[80px]" style={{ background: 'radial-gradient(circle, #FB923C 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full opacity-25 blur-[90px]" style={{ background: 'radial-gradient(circle, #22D3C4 0%, transparent 70%)' }} />
      </div>
    </motion.div>
  )
}

function FloatingNav({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement> }) {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll({ container: scrollRef })
  const { transitionTo } = usePageTransition()

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 24)
  })

  return (
    <div className="sticky top-0 z-50 flex justify-center px-4 pt-0">
      <motion.nav
        animate={{
          marginTop: scrolled ? 14 : 0,
          width: scrolled ? '92%' : '100%',
          borderRadius: scrolled ? 999 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className={
          scrolled
            ? 'max-w-5xl border border-[#F1F5F3]/[0.09] bg-[#0A0C0B]/80 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.4)]'
            : 'max-w-7xl border-b border-[#F1F5F3]/[0.08] bg-[#0A0C0B]/90 backdrop-blur-xl'
        }
      >
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl border border-primary/25 flex items-center justify-center bg-primary/10">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-black tracking-[0.2em] uppercase">Novo</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a href="#precios" className="hidden sm:inline text-sm font-medium text-[#F1F5F3]/60 hover:text-[#F1F5F3] transition-colors whitespace-nowrap">
              Precios
            </a>
            <Link href="/auth/signin" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signin') }} className="text-sm font-medium text-[#F1F5F3]/60 hover:text-[#F1F5F3] transition-colors whitespace-nowrap">
              Iniciar sesión
            </Link>
            <Button asChild size="sm" className="shadow-[0_0_20px_rgba(34,211,196,0.35)] hover:shadow-[0_0_28px_rgba(34,211,196,0.55)] whitespace-nowrap shrink-0">
              <Link href="/auth/signup" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signup') }}>Empezar gratis</Link>
            </Button>
          </div>
        </div>
      </motion.nav>
    </div>
  )
}

export default function LandingPage() {
  return (
    <PageTransitionProvider>
      <LandingPageContent />
    </PageTransitionProvider>
  )
}

function LandingPageContent() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { transitionTo } = usePageTransition()

  return (
    <div
      ref={scrollRef}
      className="h-dvh w-full bg-[#0A0C0B] text-[#F1F5F3] overflow-y-auto overflow-x-hidden custom-scrollbar"
      // Landing is a fixed-brand marketing surface — pin --primary to the Novo
      // indigo so it never inherits the user's in-app accent (e.g. orange),
      // which SettingsProvider writes onto :root globally.
      style={{
        ['--primary' as string]: '#22D3C4',
        ['--primary-rgb' as string]: '34, 211, 196',
        ['--primary-glow' as string]: 'rgba(34,211,196,0.5)',
        ['--ring' as string]: '#22D3C4',
        // Headline-only display face — Inter (this app's --font-sans, used
        // everywhere) is one of the most overused faces in AI-generated UI.
        // Swapping it wholesale is riskier than the payoff on a deadline day,
        // so only h1/h2 opt into this via font-display; body copy keeps Inter.
        ['--font-display' as string]: "'Outfit', var(--font-sans)",
      } as React.CSSProperties}
    >
      <SmoothScrollProvider scrollRef={scrollRef}>
        <div>
          <a
            href="#landing-main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-full focus:bg-[#F1F5F3] focus:text-[#0A0C0B] focus:text-sm focus:font-medium"
          >
            Saltar al contenido
          </a>
          <FloatingNav scrollRef={scrollRef} />

          <main id="landing-main">
          <section className="relative overflow-hidden">
            {/* Ghosted background wordmark — warm, barely-there texture */}
            <div className="absolute inset-x-0 top-[6%] flex justify-center pointer-events-none select-none z-0">
              <span className="text-[20vw] leading-none font-black tracking-tighter text-[#F1F5F3]/[0.04] whitespace-nowrap">
                COGNITIVE
              </span>
            </div>
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] rounded-full opacity-10 blur-[160px] pointer-events-none" style={{ background: 'radial-gradient(circle, #22D3C4 0%, transparent 70%)' }} />

            <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-16">
              {/* Spec-sheet top row */}
              <div className="flex items-start justify-between text-[10px] font-bold tracking-[0.2em] uppercase text-[#F1F5F3]/40 mb-8">
                <div className="space-y-0.5">
                  <div>SEQ.001 / TWIN&nbsp;ONLINE</div>
                  <div className="text-[#F1F5F3]/20">República Dominicana · GMT-4</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-primary/70">OBSERVE → INTERPRET → PREDICT → GUIDE → LEARN</div>
                  <div className="text-[#F1F5F3]/20">Ciclo continuo, no una foto fija</div>
                </div>
              </div>

              {/* Dominant visual: gradient placeholder replacing the old 3D
                  graph — swap for a real product screenshot when available. */}
              <HeroVisual />

              <motion.div
                className="relative z-10 text-center px-4 max-w-3xl mx-auto"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springConfig.gentle}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black tracking-[0.25em] uppercase text-primary">Cognitive Operating System</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-light italic tracking-tight leading-[1.05] mb-6" style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' } as React.CSSProperties}>
                  Deja de organizar tareas.<br />
                  <span className="not-italic font-semibold">Empieza a ejecutar con tu energía real.</span>
                </h1>
                <p className="text-base md:text-lg text-[#F1F5F3]/70 max-w-xl mx-auto mb-8 leading-relaxed">
                  Novo construye un <strong className="text-[#F1F5F3] font-semibold">Gemelo Cognitivo</strong> a partir de tu comportamiento real
                  para responder una sola pregunta: ¿qué deberías hacer ahora mismo?
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="text-base px-8 shadow-[0_0_30px_rgba(34,211,196,0.4)] hover:shadow-[0_0_44px_rgba(34,211,196,0.65)] hover:-translate-y-0.5"
                  >
                    <Link href="/auth/signup" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signup') }}>
                      Empezar gratis <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <a href="#como-funciona" className="text-sm font-medium text-[#F1F5F3]/60 hover:text-[#F1F5F3] transition-colors">
                    Ver cómo funciona ↓
                  </a>
                </div>
              </motion.div>

              {/* Spec-sheet bottom row: pipeline tags + live status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-[#F1F5F3]/[0.08] text-[10px] font-bold tracking-[0.15em] uppercase text-[#F1F5F3]/35">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {PIPELINE.map((p) => (
                    <span key={p.label}>+ {p.label}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400/90">Tu Twin empieza a aprender desde hoy</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Product proof — the real UI, not a mockup ──────────────────── */}
          <section className="max-w-6xl mx-auto px-6 pb-16 md:pb-24">
            <ScrollReveal>
              <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[#F1F5F3]/35 mb-4 text-center">Esto es Novo, no un concepto</p>
              <motion.div
                className="rounded-3xl border border-[#F1F5F3]/10 overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
                whileHover={{ transform: 'scale(1.01)', borderColor: 'rgba(34,211,196,0.35)' }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#F1F5F3]/[0.04] border-b border-[#F1F5F3]/[0.08]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F1F5F3]/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F1F5F3]/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F1F5F3]/15" />
                  <span className="ml-3 text-[10px] text-[#F1F5F3]/40 font-medium">productivitynovo.vercel.app/ai</span>
                </div>
                <Image
                  src="/landing/product-ai.png"
                  alt="Chat con el Cognitive Twin de Novo, capturado en producción"
                  width={1218}
                  height={504}
                  className="w-full h-auto"
                  priority
                />
              </motion.div>
            </ScrollReveal>
          </section>

          {/* ── Reframe ─────────────────────────────────────────────────────── */}
          <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
            <ScrollReveal>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  className="rounded-3xl p-8 border border-[#F1F5F3]/[0.08] bg-[#F1F5F3]/[0.03] backdrop-blur-xl"
                  whileHover={{ transform: 'translateY(-4px)', borderColor: 'rgba(241,245,243,0.18)', backgroundColor: 'rgba(241,245,243,0.06)' }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#F1F5F3]/50">Antes</span>
                  <p className="text-xl text-[#F1F5F3]/70 font-light mt-3 leading-relaxed">
                    Una lista de tareas que no sabe si estás agotado, disperso o en tu mejor momento del día —
                    y aun así te pide que decidas tú qué hacer primero.
                  </p>
                </motion.div>
                <motion.div
                  className="rounded-3xl p-8 border border-primary/30 bg-primary/[0.07] backdrop-blur-xl relative overflow-hidden"
                  whileHover={{ transform: 'translateY(-4px)', borderColor: 'rgba(34,211,196,0.55)' }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/25 blur-[60px] pointer-events-none" />
                  <span className="relative text-[10px] font-black tracking-[0.25em] uppercase text-primary">Con Novo</span>
                  <p className="relative text-xl text-[#F1F5F3] font-light mt-3 leading-relaxed">
                    Un sistema que interpreta tu energía y tus patrones reales, y te da{' '}
                    <span className="font-semibold text-[#F1F5F3]">una directiva clara</span> en vez de una lista infinita.
                  </p>
                </motion.div>
              </div>
            </ScrollReveal>
          </section>

          {/* ── How it works ────────────────────────────────────────────────── */}
          <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-16 md:py-24 scroll-mt-16">
            <ScrollReveal>
              <p className="text-[10px] font-black tracking-[0.25em] uppercase text-primary mb-3 text-center">Cómo funciona</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-center mb-4" style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' } as React.CSSProperties}>El motor detrás del Twin</h2>
              <p className="text-[#F1F5F3]/60 text-center max-w-xl mx-auto mb-14">
                Cinco etapas que corren en segundo plano cada vez que usas Novo.
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {PIPELINE.map((stage, i) => (
                <ScrollReveal key={stage.label} delay={i * 0.06}>
                  <motion.div
                    className="rounded-2xl p-5 h-full border border-[#F1F5F3]/[0.08] bg-[#F1F5F3]/[0.03] backdrop-blur-xl flex flex-col gap-3"
                    whileHover={{ transform: 'translateY(-6px)', borderColor: 'rgba(34,211,196,0.4)', boxShadow: '0 20px 50px rgba(34,211,196,0.15)' }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <stage.icon className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-sm font-bold tracking-wide uppercase text-[#F1F5F3]/90">{stage.label}</p>
                    <p className="text-xs text-[#F1F5F3]/60 leading-relaxed">{stage.detail}</p>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          </section>

          {/* ── Differentiation ─────────────────────────────────────────────── */}
          <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
            <ScrollReveal>
              <h2 className="text-3xl md:text-4xl font-semibold text-center mb-14" style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' } as React.CSSProperties}>
                No es una app de productividad más
              </h2>
            </ScrollReveal>
            {/* items-start (not stretch) + a slight offset on the middle card:
                three perfectly equal-height, perfectly aligned columns is the
                most common AI-generated layout tell. Letting height follow
                content and staggering the center card breaks that symmetry
                without touching the responsive/grid structure. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {DIFFERENTIATORS.map((d, i) => (
                <ScrollReveal key={d.title} delay={i * 0.08}>
                  <motion.div
                    className={`rounded-3xl p-7 border border-[#F1F5F3]/[0.08] bg-[#F1F5F3]/[0.03] backdrop-blur-xl ${i === 1 ? 'md:translate-y-6' : ''}`}
                    whileHover={{ transform: i === 1 ? 'translateY(-2px)' : 'translateY(-6px)', borderColor: 'rgba(34,211,196,0.4)', boxShadow: '0 20px 50px rgba(34,211,196,0.15)' }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <p className="font-semibold text-[#F1F5F3] mb-2">{d.title}</p>
                    <p className="text-sm text-[#F1F5F3]/60 leading-relaxed">{d.detail}</p>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          </section>

          {/* ── Pricing ─────────────────────────────────────────────────────── */}
          <section id="precios" className="max-w-5xl mx-auto px-6 py-16 md:py-24 scroll-mt-16">
            <ScrollReveal>
              <h2 className="text-3xl md:text-4xl font-semibold text-center mb-3" style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' } as React.CSSProperties}>
                Empieza gratis. Crece cuando lo necesites.
              </h2>
              <p className="text-center text-[#F1F5F3]/55 max-w-md mx-auto mb-14">
                Sin tarjeta para probar. Cambia o cancela cuando quieras.
              </p>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <ScrollReveal>
                <div className="rounded-3xl p-8 h-full border border-[#F1F5F3]/[0.08] bg-[#F1F5F3]/[0.03] backdrop-blur-xl flex flex-col">
                  <p className="font-semibold text-[#F1F5F3] mb-1">Free</p>
                  <p className="text-sm text-[#F1F5F3]/50 mb-6">Para empezar a construir tu Twin</p>
                  <p className="text-4xl font-bold text-[#F1F5F3] mb-6">$0</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {['20 acciones de IA al mes', 'Cognitive Twin completo', 'Todos los módulos'].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#F1F5F3]/65">
                        <Check className="w-4 h-4 text-[#F1F5F3]/35 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="border-[#F1F5F3]/20 hover:bg-[#F1F5F3]/5">
                    <Link href="/auth/signup" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signup') }}>Empezar gratis</Link>
                  </Button>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.08}>
                <motion.div
                  className="relative rounded-3xl p-8 h-full border border-primary/30 bg-primary/[0.06] backdrop-blur-xl flex flex-col"
                  whileHover={{ transform: 'translateY(-6px)', boxShadow: '0 20px 50px rgba(34,211,196,0.2)' }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="absolute top-8 right-8 text-[10px] font-black uppercase tracking-wide text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    Recomendado
                  </span>
                  <p className="font-semibold text-[#F1F5F3] mb-1">Pro</p>
                  <p className="text-sm text-[#F1F5F3]/50 mb-6">Para operar sin límites</p>
                  <p className="text-4xl font-bold text-[#F1F5F3] mb-6">$9.99<span className="text-base font-normal text-[#F1F5F3]/50">/mes</span></p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {['Acciones de IA ilimitadas', 'Cognitive Twin completo', 'Todos los módulos', 'Soporte prioritario'].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#F1F5F3]/75">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="shadow-[0_0_20px_rgba(34,211,196,0.35)] hover:shadow-[0_0_28px_rgba(34,211,196,0.55)]">
                    <Link href="/auth/signup" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signup') }}>Empezar con Pro</Link>
                  </Button>
                </motion.div>
              </ScrollReveal>
            </div>
          </section>

          {/* ── Final CTA ───────────────────────────────────────────────────── */}
          <section className="relative max-w-3xl mx-auto px-6 py-20 md:py-28 text-center overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[160%] rounded-full opacity-10 blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, #22D3C4 0%, transparent 70%)' }} />
            <ScrollReveal>
              <h2 className="relative text-3xl md:text-5xl font-light italic tracking-tight mb-6" style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' } as React.CSSProperties}>
                Tu Twin está listo <span className="not-italic font-semibold">para empezar a aprender.</span>
              </h2>
              <p className="relative text-[#F1F5F3]/60 mb-8 max-w-lg mx-auto">
                Dos minutos para configurar tu perfil cognitivo. El resto lo construye tu comportamiento real.
              </p>
              <Button
                asChild
                size="lg"
                className="relative text-base px-8 shadow-[0_0_30px_rgba(34,211,196,0.4)] hover:shadow-[0_0_44px_rgba(34,211,196,0.65)] hover:-translate-y-0.5"
              >
                <Link href="/auth/signup" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signup') }}>
                  Empezar gratis <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </ScrollReveal>
          </section>
          </main>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <footer className="border-t border-[#F1F5F3]/[0.08]">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-xs text-[#F1F5F3]/50">
              <span>© {new Date().getFullYear()} Novo · Cognitive Operating System</span>
              <div className="flex items-center gap-5">
                <Link href="/privacy" className="hover:text-[#F1F5F3] transition-colors">Privacidad</Link>
                <Link href="/terms" className="hover:text-[#F1F5F3] transition-colors">Condiciones</Link>
                <Link href="/auth/signin" onClick={(e) => { e.preventDefault(); transitionTo('/auth/signin') }} className="hover:text-[#F1F5F3] transition-colors">Iniciar sesión</Link>
              </div>
            </div>
          </footer>
        </div>
      </SmoothScrollProvider>
    </div>
  )
}
