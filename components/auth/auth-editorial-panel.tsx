'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useNovoMotionPolicy } from '@/hooks/use-novo-motion-policy'

type AuthEditorialPanelProps = {
  mode?: 'signin' | 'signup'
}

const PANEL_COPY = {
  signin: {
    artwork: '/landing/novo-auth-context-compass-v1.webp',
    description: 'Novo keeps the thread between what changed, what matters, and what comes next.',
  },
  signup: {
    artwork: '/landing/novo-auth-memory-vessel-v1.webp',
    description: 'Start with a Twin that learns from real signals and keeps its reasoning visible.',
  },
} as const

const SIGNALS = [
  { label: 'Signal', value: 'A plan moved', className: 'left-[7%] top-[54%] -rotate-[4deg]', delay: 0.48 },
  { label: 'Context', value: 'The thread stayed', className: 'right-[6%] top-[59%] rotate-[3deg]', delay: 0.64 },
  { label: 'Direction', value: 'A next move formed', className: 'left-[17%] bottom-[13%] rotate-[2deg]', delay: 0.8 },
] as const

/**
 * A compact continuation of Novo's landing world. The artwork is authored for
 * authentication rather than copied from the hero: scattered evidence becomes
 * one inspectable model while the form remains the clear interactive task.
 */
export function AuthEditorialPanel({ mode = 'signin' }: AuthEditorialPanelProps) {
  const reduceMotion = useNovoMotionPolicy() !== 'full'
  const copy = PANEL_COPY[mode]

  return (
    <aside
      aria-label="Novo Cognitive Twin"
      className="relative hidden min-h-dvh w-1/2 overflow-hidden bg-[#F2EEE4] text-[#182017] lg:flex lg:flex-col"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 origin-center"
        initial={reduceMotion ? false : { opacity: 0.72, scale: 1.035 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 1.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <Image
          src={copy.artwork}
          alt=""
          fill
          priority
          sizes="50vw"
          className="select-none object-cover object-center"
        />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(248,243,233,.2)_0%,rgba(248,243,233,.06)_48%,rgba(15,36,25,.16)_100%)]" />
      <div className="pointer-events-none absolute -right-24 top-[17%] size-[27rem] rounded-full bg-[#A8C99D]/14 blur-[120px]" />

      <header className="relative z-20 flex items-center justify-between px-9 pt-8 xl:px-12 xl:pt-10">
        <a href="/landing" className="group flex items-center gap-3" aria-label="Novo landing page">
          <span className="grid size-9 place-items-center overflow-hidden rounded-full border border-[#31563F]/15 bg-[#F8F4EA]/75 shadow-[0_10px_30px_rgba(45,65,49,.1)] backdrop-blur-md transition-transform duration-300 group-hover:scale-[1.04]">
            <Image src="/icon.svg" alt="" width={24} height={24} className="size-6 object-contain" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Novo</span>
        </a>
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#31563F]/55">
          Cognitive Twin
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-9 pb-8 pt-[8vh] xl:px-12">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20"
        >
          <h1 className="max-w-[10.5ch] text-[clamp(2.65rem,3.85vw,4.7rem)] font-medium leading-[0.9] tracking-[-0.068em]">
            Information isn&apos;t the problem.
            <span className="mt-2 block text-[#31563F]">Shared context is.</span>
          </h1>
          <p className="mt-5 max-w-[19rem] bg-[#F7F1E3]/78 px-3.5 py-3 text-[13px] leading-relaxed text-[#253A2B]/72 shadow-[0_14px_30px_rgba(40,58,43,.09)] backdrop-blur-sm">
            {copy.description}
          </p>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 top-[38%] z-10" aria-hidden="true">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <motion.path
              d="M8 42 C22 31 28 50 40 45 C52 40 54 28 66 34 C77 40 67 56 78 63 C85 67 91 61 95 55"
              fill="none"
              stroke="rgba(45,83,61,.5)"
              strokeWidth="0.28"
              strokeLinecap="round"
              strokeDasharray="1.15 1.55"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 1.75, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d="M92.2 52.8 L95 55 L91.2 56.5"
              fill="none"
              stroke="rgba(45,83,61,.7)"
              strokeWidth="0.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.42, delay: 1.78 }}
            />
          </svg>

          {SIGNALS.map((signal) => (
            <motion.div
              key={signal.label}
              className={`absolute z-20 min-w-[8.5rem] bg-[#F7F1E3]/88 px-3.5 py-2.5 shadow-[0_16px_32px_rgba(40,58,43,.14)] backdrop-blur-sm ${signal.className}`}
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.68, delay: signal.delay, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-[8px] font-semibold uppercase tracking-[0.19em] text-[#4E775B]">{signal.label}</p>
              <p className="mt-1 text-[11px] font-medium tracking-[-0.02em] text-[#1D3528]">{signal.value}</p>
            </motion.div>
          ))}
        </div>

        <p className="relative z-20 mt-auto text-[9px] font-medium uppercase tracking-[0.16em] text-[#F8F4EA]/65">
          © {new Date().getFullYear()} Novo
        </p>
      </div>
    </aside>
  )
}
