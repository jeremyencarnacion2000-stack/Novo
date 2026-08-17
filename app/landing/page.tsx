'use client'

import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { ArrowRight, Check, Compass, Eye, Radar } from 'lucide-react'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
import { PageTransitionProvider, usePageTransition } from '@/components/landing/page-transition-overlay'
import currentProductCapture from '../../docs/release/evidence/current-cognitive-product-desktop.png'

const PREMIUM_EASE = [0.4, 0, 0.2, 1] as const
const DARK_HEADING_STYLE = { color: '#F4F0E8' } as const

const TWIN_NODES = [
  { id: 'now', label: 'Contexto actual', detail: 'Lo que cambió hoy', x: 50, y: 50, r: 4.5, tone: '#F4F0E8' },
  { id: 'intent', label: 'Intención', detail: 'Publicar Novo', x: 31, y: 29, r: 2.7, tone: '#A6D6B5' },
  { id: 'focus', label: 'Patrón', detail: 'Ventana de enfoque', x: 68, y: 28, r: 2.5, tone: '#83B996' },
  { id: 'evidence', label: 'Evidencia', detail: 'Trabajo verificado', x: 22, y: 55, r: 2.2, tone: '#789487' },
  { id: 'outcome', label: 'Resultado', detail: 'Bloqueo resuelto', x: 76, y: 56, r: 2.7, tone: '#DCCF9F' },
  { id: 'learning', label: 'Aprendizaje', detail: 'Ritmo confirmado', x: 36, y: 73, r: 2.5, tone: '#B7E4C2' },
  { id: 'direction', label: 'Dirección', detail: 'Siguiente acción', x: 64, y: 75, r: 3, tone: '#8FCDB8' },
] as const

const TWIN_EDGES = [
  ['now', 'intent'], ['now', 'focus'], ['now', 'evidence'], ['now', 'outcome'],
  ['evidence', 'learning'], ['outcome', 'direction'], ['learning', 'direction'],
] as const

const COGNITIVE_STEPS = [
  { title: 'Observa', body: 'Recibe señales del trabajo, los hábitos y las conexiones que eliges.', icon: Eye },
  { title: 'Comprende', body: 'Relaciona intención, energía, evidencia y resultados en un contexto continuo.', icon: Radar },
  { title: 'Guía', body: 'Convierte ese contexto en una siguiente acción clara para el momento actual.', icon: Compass },
  { title: 'Aprende', body: 'Cada resultado corrige o refuerza lo que el Twin entiende de ti.', icon: Check },
] as const

function LandingTransitionLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const { transitionTo } = usePageTransition()

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        transitionTo(href)
      }}
      className={className}
    >
      {children}
    </Link>
  )
}

function ScrollProgress({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 32, mass: 0.25 })
  return <motion.div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-px origin-left bg-[#ADEBC1]" style={{ scaleX: progress }} />
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border border-white/[0.09] bg-[#07100c]/78 px-4 shadow-[0_14px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-5">
        <Link href="/landing" className="group flex items-center gap-2.5" aria-label="Novo, inicio">
          <span className="grid size-7 place-items-center overflow-hidden rounded-full border border-[#ADEBC1]/25 bg-[#ADEBC1]/[0.08] transition-transform duration-300 group-hover:scale-[1.04]">
            <Image src="/icon.svg" alt="" width={20} height={20} className="size-5 object-contain" priority />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#F4F0E8]">Novo</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <a href="#sistema" className="hidden text-sm text-white/58 transition-colors hover:text-white sm:block">Cómo funciona</a>
          <a href="#producto" className="hidden text-sm text-white/58 transition-colors hover:text-white md:block">Producto</a>
          <a href="#precios" className="hidden text-sm text-white/58 transition-colors hover:text-white lg:block">Planes</a>
          <LandingTransitionLink href="/auth/signin?callbackUrl=%2Fonboarding" className="hidden text-sm text-white/72 transition-colors hover:text-white md:block">Entrar</LandingTransitionLink>
          <LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="inline-flex h-9 items-center rounded-full bg-[#F4F0E8] px-4 text-xs font-semibold text-[#07100c] transition duration-200 hover:bg-[#ADEBC1] active:scale-[0.97]">
            Crear mi Twin <ArrowRight className="ml-1.5 size-3.5" />
          </LandingTransitionLink>
        </div>
      </nav>
    </header>
  )
}

function LandingTwinField() {
  const reduceMotion = useReducedMotion()
  const [selectedId, setSelectedId] = useState('now')
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const softX = useSpring(pointerX, { stiffness: 82, damping: 23, mass: 0.75 })
  const softY = useSpring(pointerY, { stiffness: 82, damping: 23, mass: 0.75 })
  const fieldX = useTransform(softX, [-0.5, 0.5], ['39%', '61%'])
  const fieldY = useTransform(softY, [-0.5, 0.5], ['34%', '62%'])
  const rotateX = useTransform(softY, [-0.5, 0.5], [1.6, -1.6])
  const rotateY = useTransform(softX, [-0.5, 0.5], [-1.8, 1.8])
  const ambientField = useMotionTemplate`radial-gradient(circle at ${fieldX} ${fieldY}, rgba(173,235,193,.18), rgba(7,16,12,0) 43%)`
  const selectedNode = TWIN_NODES.find((node) => node.id === selectedId) ?? TWIN_NODES[0]

  return (
    <motion.div
      data-testid="landing-twin-field"
      aria-label="Explorar el contexto del Twin"
      className="relative mx-auto w-full max-w-[43rem] [perspective:1000px]"
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType === 'touch') return
        const bounds = event.currentTarget.getBoundingClientRect()
        pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5)
        pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5)
      }}
      onPointerLeave={() => { pointerX.set(0); pointerY.set(0) }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="relative aspect-[.88/1] overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#07100c]/72 shadow-[0_42px_120px_rgba(0,0,0,0.42)] sm:aspect-[1.12/1]"
        style={reduceMotion ? undefined : { rotateX, rotateY, backgroundImage: ambientField }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(173,235,193,.08),transparent_46%)]" />
        <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between text-[10px] font-medium text-white/52 sm:inset-x-7 sm:top-7">
          <span>Tu contexto, conectado</span>
          <span className="inline-flex items-center gap-2 text-[#ADEBC1]"><span className="landing-motion-layer size-1.5 rounded-full bg-[#ADEBC1]" />Aprendiendo</span>
        </div>

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-6 pt-11 sm:p-9 sm:pt-14" role="group">
          <motion.path
            d="M50 12 C31 5 14 19 15 40 C5 50 12 72 29 76 C34 91 47 88 50 82 C53 88 66 91 71 76 C88 72 95 50 85 40 C86 19 69 5 50 12 Z"
            fill="rgba(173,235,193,.025)"
            stroke="rgba(210,235,218,.24)"
            strokeWidth="0.62"
            strokeDasharray="1.35 2.15"
                initial={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0.18, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.15, ease: PREMIUM_EASE }}
          />
          <path d="M50 13 C46 27 48 41 50 50 C52 61 53 71 50 82" fill="none" stroke="rgba(210,235,218,.11)" strokeDasharray="1 2.4" strokeWidth="0.4" />
          {TWIN_EDGES.map(([sourceId, targetId], index) => {
            const source = TWIN_NODES.find((node) => node.id === sourceId)!
            const target = TWIN_NODES.find((node) => node.id === targetId)!
            const active = selectedId === sourceId || selectedId === targetId
            return (
              <motion.line
                key={`${sourceId}-${targetId}`}
                x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                stroke={active ? 'rgba(173,235,193,.62)' : 'rgba(210,235,218,.22)'}
                strokeWidth={active ? 0.72 : 0.45}
                    initial={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.72, delay: 0.16 + index * 0.035, ease: PREMIUM_EASE }}
              />
            )
          })}
          {TWIN_NODES.map((node, index) => {
            const selected = node.id === selectedId
            return (
                  <motion.g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    aria-label={`${node.label}: ${node.detail}`}
                className="cursor-pointer outline-none"
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId(node.id)
                  }
                }}
                initial={reduceMotion ? false : { opacity: 0.28, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.52, delay: 0.24 + index * 0.035, ease: PREMIUM_EASE }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <motion.circle cx={node.x} cy={node.y} r={node.r * 2.2} fill={node.tone} animate={reduceMotion || !selected ? { opacity: selected ? 0.18 : 0.055 } : { opacity: [0.12, 0.24, 0.12], scale: [1, 1.1, 1] }} transition={reduceMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: PREMIUM_EASE }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.tone} opacity={selected ? 1 : 0.78} />
                <circle cx={node.x} cy={node.y} r={node.r + 1.2} fill="none" stroke={selected ? '#ADEBC1' : 'transparent'} strokeWidth="0.55" />
              </motion.g>
            )
          })}
        </svg>

        <motion.div
          key={selectedNode.id}
          initial={reduceMotion ? false : { opacity: 0.45, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease: PREMIUM_EASE }}
          className="absolute inset-x-5 bottom-5 z-20 flex items-end justify-between gap-4 rounded-[1.2rem] border border-white/[0.09] bg-[#07100c]/82 px-4 py-3 backdrop-blur-xl sm:inset-x-7 sm:bottom-7 sm:px-5 sm:py-4"
        >
          <div><p className="text-[10px] text-white/42">{selectedNode.label}</p><p className="mt-1 text-sm font-medium text-[#F4F0E8] sm:text-base">{selectedNode.detail}</p></div>
          <span className="text-[10px] text-[#ADEBC1]">Toca otro nodo</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function CognitiveSequence({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> }) {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: sectionRef, container: scrollContainer, offset: ['start 78%', 'end 35%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 28, mass: 0.5 })
  const lineScale = useTransform(progress, [0, 1], [0.08, 1])
  const orbit = useTransform(progress, [0, 1], [-10, 18])
  const variants = {
    hidden: { opacity: 0.5, y: 24, clipPath: 'inset(0 0 12% 0)' },
    visible: { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' },
  }

  return (
    <section ref={sectionRef} id="sistema" data-testid="cognitive-sequence" className="relative px-6 py-24 sm:px-10 lg:px-16 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[.82fr_1.18fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:h-fit">
          <p className="max-w-md text-base leading-relaxed text-[#ADEBC1]">Un sistema que cambia con la realidad.</p>
          <h2 className="mt-5 max-w-xl text-[clamp(2.8rem,5.2vw,5.6rem)] font-medium leading-[0.94] tracking-[-0.068em]" style={DARK_HEADING_STYLE}>No solo recuerda. Reconsidera.</h2>
          <p className="mt-7 max-w-md text-base leading-relaxed text-white/56 sm:text-lg">El Twin conecta lo que querías hacer con lo que realmente ocurrió. Esa diferencia cambia la siguiente decisión.</p>
          <div className="relative mt-12 hidden h-36 max-w-sm overflow-hidden lg:block" aria-hidden="true">
            <div className="absolute left-4 top-0 h-full w-px bg-white/[0.08]" />
            <motion.div className="absolute left-4 top-0 h-full w-px origin-top bg-[#ADEBC1]/65" style={{ scaleY: reduceMotion ? 1 : lineScale }} />
            <motion.div className="absolute left-0 top-5 size-8 rounded-full border border-[#ADEBC1]/28 bg-[#ADEBC1]/[0.08]" style={reduceMotion ? undefined : { y: orbit }} />
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {COGNITIVE_STEPS.map(({ title, body, icon: Icon }, index) => (
            <motion.article
              key={title}
              initial={reduceMotion ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.38 }}
              variants={variants}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.62, delay: index * 0.055, ease: PREMIUM_EASE }}
              className="group grid min-h-44 grid-cols-[2.8rem_1fr] gap-5 rounded-[1.6rem] border border-white/[0.085] bg-[#0A120E]/72 p-6 transition-colors duration-500 hover:border-[#ADEBC1]/20 hover:bg-[#0D1712] sm:grid-cols-[3.2rem_1fr] sm:p-8"
            >
              <span className="grid size-11 place-items-center rounded-full border border-[#ADEBC1]/18 bg-[#ADEBC1]/[0.055] text-[#ADEBC1] transition-transform duration-500 group-hover:scale-[1.06]"><Icon className="size-4" /></span>
              <div><h3 className="text-2xl font-medium tracking-[-0.04em]" style={DARK_HEADING_STYLE}>{title}</h3><p className="mt-4 max-w-md text-sm leading-relaxed text-white/54 sm:text-base">{body}</p></div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContextMask({ scrollContainer }: { scrollContainer: RefObject<HTMLDivElement | null> }) {
  const maskRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: maskRef, container: scrollContainer, offset: ['start end', 'end start'] })
  const maskShift = useTransform(scrollYProgress, [0, 1], ['38%', '62%'])

  return (
    <div ref={maskRef} className="relative overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#09110D] px-5 py-16 sm:px-10 sm:py-24">
      <motion.h2
        className="text-center text-[clamp(3.1rem,14vw,13rem)] font-medium leading-[0.78] tracking-[-0.095em] text-transparent [background-clip:text] [-webkit-background-clip:text]"
        style={{
          backgroundImage: `linear-gradient(rgba(244,240,232,.9),rgba(173,235,193,.8)), url('${currentProductCapture.src}')`,
          backgroundBlendMode: 'multiply',
          backgroundPositionX: reduceMotion ? '50%' : maskShift,
          backgroundPositionY: '48%',
          backgroundSize: 'cover',
        }}
      >
        CONTEXTO
      </motion.h2>
      <p className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed text-white/58 sm:text-xl">Menos explicación. Más continuidad entre lo que piensas, haces y aprendes.</p>
    </div>
  )
}

function ProductWindow() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.figure
      initial={false}
      whileInView={{ clipPath: 'inset(0 0 0 0 round 1.75rem)', opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: PREMIUM_EASE }}
      className="overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[#0B120E] shadow-[0_32px_100px_rgba(0,0,0,0.44)]"
    >
      <div className="flex h-10 items-center gap-1.5 border-b border-white/[0.07] px-4" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" /><span className="size-1.5 rounded-full bg-white/22" />
      </div>
      <Image src={currentProductCapture} alt="Centro Cognitivo real de Novo con el cerebro navegable del Twin" className="h-auto w-full" sizes="(max-width: 1024px) 92vw, 58vw" />
      <figcaption className="flex flex-col gap-1 border-t border-white/[0.07] px-5 py-4 text-xs text-white/48 sm:flex-row sm:items-center sm:justify-between"><span>Centro Cognitivo</span><span>Contexto, evidencia y siguiente acción</span></figcaption>
    </motion.figure>
  )
}

function LandingPageContent() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const heroProgress = useTransform(scrollYProgress, [0, 0.16], [0, 1])
  const heroCopyY = useTransform(heroProgress, [0, 1], [0, -34])
  const heroGraphY = useTransform(heroProgress, [0, 1], [0, 28])
  const heroGraphScale = useTransform(heroProgress, [0, 1], [1, 0.975])

  return (
    <div ref={scrollRef} className="landing-ambient h-dvh overflow-x-hidden overflow-y-auto bg-[#06100B] text-[#F4F0E8] [scrollbar-width:none]" style={{ '--primary': '#ADEBC1', '--background': '#06100B', '--foreground': '#F4F0E8' } as CSSProperties}>
      <SmoothScrollProvider scrollRef={scrollRef}>
        <div className="min-h-full overflow-x-hidden">
          <style jsx global>{`
            @keyframes novo-breathe { 0%, 100% { opacity: .54; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.08); } }
            @keyframes novo-enter { from { opacity: .62; transform: translate3d(0, 16px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
            .landing-motion-layer { animation: novo-breathe 3.2s cubic-bezier(.4,0,.2,1) infinite; }
            .landing-enter { animation: novo-enter .72s cubic-bezier(.4,0,.2,1) both; }
            .landing-enter-title { animation-duration: .86s; animation-delay: .07s; }
            .landing-enter-body { animation-delay: .14s; }
            .landing-enter-actions { animation-delay: .21s; }
            @media (prefers-reduced-motion: reduce) { .landing-motion-layer, .landing-enter { animation: none !important; transform: none !important; } }
          `}</style>
          <ScrollProgress scrollRef={scrollRef} />
          <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-[#ADEBC1] focus:px-4 focus:py-2 focus:text-sm focus:text-[#06100B]">Saltar al contenido</a>
          <LandingNav />

          <main id="contenido">
            <section className="relative isolate min-h-[calc(100dvh-68px)] overflow-hidden px-6 pb-16 pt-12 sm:px-10 lg:flex lg:items-center lg:px-16 lg:py-16">
              <div className="pointer-events-none absolute -left-24 top-[8%] -z-10 size-[34rem] rounded-full bg-[#225D3A]/18 blur-[150px]" />
              <div className="pointer-events-none absolute right-[5%] top-[20%] -z-10 size-[28rem] rounded-full bg-[#ADEBC1]/[0.045] blur-[130px]" />
              <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-14 xl:gap-20">
                <motion.div className="relative z-10 max-w-2xl" style={reduceMotion ? undefined : { y: heroCopyY }}>
                  <motion.p initial={false} className="landing-enter landing-enter-lead max-w-xl text-base leading-relaxed text-[#ADEBC1] sm:text-lg">La próxima interfaz para la IA no es otro chat.</motion.p>
                  <motion.h1 initial={false} className="landing-enter landing-enter-title mt-5 max-w-2xl text-[clamp(3.5rem,5.7vw,6.25rem)] font-medium leading-[0.9] tracking-[-0.075em]" style={DARK_HEADING_STYLE}>Es contexto compartido.</motion.h1>
                  <motion.p initial={false} className="landing-enter landing-enter-body mt-7 max-w-lg text-lg leading-relaxed text-white/60">Novo construye un Twin que aprende de lo que haces y adapta cada siguiente decisión.</motion.p>
                  <motion.div initial={false} className="landing-enter landing-enter-actions mt-9 flex flex-wrap items-center gap-4">
                    <LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="group inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] shadow-[0_16px_50px_rgba(173,235,193,0.14)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]">
                      Crear mi Twin <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </LandingTransitionLink>
                    <a href="#sistema" className="group inline-flex h-12 items-center gap-2 px-2 text-sm font-medium text-white/70 transition-colors hover:text-white">Ver cómo aprende <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" /></a>
                  </motion.div>
                </motion.div>
                <motion.div style={reduceMotion ? undefined : { y: heroGraphY, scale: heroGraphScale }}><LandingTwinField /></motion.div>
              </div>
            </section>

            <section className="border-y border-white/[0.07] bg-[#08120D] px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
              <motion.div initial={reduceMotion ? false : { opacity: 0.7, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.72, ease: PREMIUM_EASE }} className="mx-auto max-w-7xl lg:pl-[28%]">
                <h2 className="max-w-4xl text-[clamp(2.7rem,5.2vw,5.7rem)] font-medium leading-[0.94] tracking-[-0.068em]" style={DARK_HEADING_STYLE}>Una IA que responde todavía depende de que vuelvas a explicarte.</h2>
                <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/56">Novo mantiene intención, evidencia y resultados unidos. El contexto no desaparece cuando termina una conversación.</p>
              </motion.div>
            </section>

            <section className="px-6 py-16 sm:px-10 lg:px-16 lg:py-24"><div className="mx-auto max-w-7xl"><ContextMask scrollContainer={scrollRef} /></div></section>

            <CognitiveSequence scrollContainer={scrollRef} />

            <section id="producto" className="relative overflow-hidden border-y border-white/[0.07] bg-[#08120D] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
              <div className="pointer-events-none absolute -right-40 top-1/4 size-[36rem] rounded-full bg-[#ADEBC1]/[0.055] blur-[160px]" />
              <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
                <motion.div initial={reduceMotion ? false : { opacity: 0.65, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.72, ease: PREMIUM_EASE }}>
                  <h2 className="max-w-lg text-[clamp(2.7rem,4.8vw,5rem)] font-medium leading-[0.94] tracking-[-0.065em]" style={DARK_HEADING_STYLE}>Puedes ver qué sabe. Y por qué lo sabe.</h2>
                  <p className="mt-7 max-w-md text-lg leading-relaxed text-white/56">El Centro Cognitivo convierte memoria, patrones y evidencia en un mapa que puedes explorar, corregir y hacer crecer.</p>
                  <div className="mt-8 grid gap-3 text-sm text-white/68">
                    {['Nodos con procedencia visible', 'Relaciones que explican cada recomendación', 'Aprendizajes que cambian con resultados reales'].map((item) => <div key={item} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full border border-[#ADEBC1]/18 text-[#ADEBC1]"><Check className="size-3.5" /></span>{item}</div>)}
                  </div>
                </motion.div>
                <ProductWindow />
              </div>
            </section>

            <section className="px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
              <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-24">
                <motion.h2 initial={reduceMotion ? false : { opacity: 0.62, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.72, ease: PREMIUM_EASE }} className="max-w-2xl text-[clamp(2.8rem,5.2vw,5.6rem)] font-medium leading-[0.94] tracking-[-0.068em]" style={DARK_HEADING_STYLE}>Entenderte no significa decidir por ti.</motion.h2>
                <div className="divide-y divide-white/[0.09] border-t border-white/[0.09]">
                  {[
                    ['Inspectable', 'Cada recomendación conserva hechos, inferencias y evidencia.'],
                    ['Corregible', 'Puedes cambiar una interpretación y ese cambio vuelve al Twin.'],
                    ['Bajo tu control', 'Las acciones externas requieren confirmación y dejan trazabilidad.'],
                  ].map(([title, body], index) => (
                    <motion.div key={title} initial={reduceMotion ? false : { opacity: 0.62, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.56, delay: index * 0.055, ease: PREMIUM_EASE }} className="py-7 sm:py-8"><h3 className="text-xl font-medium tracking-[-0.035em]" style={DARK_HEADING_STYLE}>{title}</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-white/52 sm:text-base">{body}</p></motion.div>
                  ))}
                </div>
              </div>
            </section>

            <section id="precios" className="px-6 pb-16 pt-6 sm:px-10 lg:px-16 lg:pb-24">
              <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0A140F]">
                <div className="grid lg:grid-cols-[.78fr_1.22fr]">
                  <div className="p-7 sm:p-10 lg:p-12">
                    <p className="text-sm font-medium text-white/48">Novo Free</p>
                    <div className="mt-6"><span className="text-5xl font-medium tracking-[-0.06em]">$0</span><span className="ml-2 text-sm text-white/42">para empezar</span></div>
                    <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/56">Crea tu primer perfil cognitivo, organiza el día y comprueba si Novo entiende tu ritmo.</p>
                    <LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="mt-9 inline-flex h-11 items-center rounded-full border border-white/[0.12] px-5 text-sm font-semibold text-[#F4F0E8] transition hover:bg-white/[0.06] active:scale-[0.98]">Crear cuenta gratis</LandingTransitionLink>
                  </div>
                  <div className="relative border-t border-white/[0.09] bg-[#101D15] p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
                    <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#ADEBC1]/[0.08] blur-3xl" />
                    <div className="relative"><p className="text-sm font-medium text-[#ADEBC1]">Novo Pro</p><div className="mt-6"><span className="text-5xl font-medium tracking-[-0.06em]">$9.99</span><span className="ml-2 text-sm text-white/48">al mes</span></div><p className="mt-5 max-w-lg text-sm leading-relaxed text-white/62">Para usar el Twin con contexto completo, historial amplio y acciones de IA ilimitadas.</p><div className="mt-7 grid gap-3 text-sm text-white/72 sm:grid-cols-2">{['Modo Twin completo', 'Mapa cognitivo avanzado', 'Historial de analíticas', 'Acciones de IA ilimitadas'].map((item) => <div key={item} className="flex items-center gap-2.5"><Check className="size-4 text-[#ADEBC1]" />{item}</div>)}</div><LandingTransitionLink href="/auth/signup?intent=pro&callbackUrl=%2Fsettings%3Ftab%3Dbilling%26source%3Dlanding-intent" className="mt-9 inline-flex h-11 items-center rounded-full bg-[#ADEBC1] px-5 text-sm font-semibold text-[#06100B] transition hover:bg-[#CBF5D8] active:scale-[0.98]">Elegir Pro <ArrowRight className="ml-2 size-4" /></LandingTransitionLink></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 pb-24 pt-8 sm:px-10 lg:px-16 lg:pb-32">
              <motion.div initial={reduceMotion ? false : { opacity: 0.7, scale: 0.985 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.35 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.75, ease: PREMIUM_EASE }} className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#ADEBC1]/16 bg-[#101D15] px-7 py-16 sm:px-12 sm:py-20 lg:px-16">
                <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[#ADEBC1]/[0.08] blur-3xl" />
                <div className="relative max-w-3xl"><h2 className="text-[clamp(3rem,6vw,6.4rem)] font-medium leading-[0.9] tracking-[-0.075em]" style={DARK_HEADING_STYLE}>Deja de reconstruir tu contexto.</h2><p className="mt-7 max-w-xl text-lg leading-relaxed text-white/58">Construye una relación con una IA que pueda aprender, explicar y reconsiderar contigo.</p><LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="mt-9 inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]">Crear mi Twin <ArrowRight className="ml-2 size-4" /></LandingTransitionLink></div>
              </motion.div>
            </section>
          </main>

          <footer className="border-t border-white/[0.07] px-6 py-8 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold uppercase tracking-[0.2em] text-white/60">Novo</span><div className="flex flex-wrap gap-x-5 gap-y-2"><LandingTransitionLink href="/auth/signin?callbackUrl=%2Fonboarding" className="hover:text-white">Entrar</LandingTransitionLink><LandingTransitionLink href="/auth/signup?callbackUrl=%2Fonboarding" className="hover:text-white">Crear cuenta</LandingTransitionLink><a href="#sistema" className="hover:text-white">Cómo funciona</a><a href="#producto" className="hover:text-white">Producto</a><a href="#precios" className="hover:text-white">Planes</a><Link href="/terms" className="hover:text-white">Términos</Link><Link href="/privacy" className="hover:text-white">Privacidad</Link><Link href="/refunds" className="hover:text-white">Reembolsos</Link></div><span>© {new Date().getFullYear()} Novo</span></div></footer>
        </div>
      </SmoothScrollProvider>
    </div>
  )
}

export default function LandingPage() {
  return <PageTransitionProvider><LandingPageContent /></PageTransitionProvider>
}
