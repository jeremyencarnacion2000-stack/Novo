'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useScrollContainer } from '@/lib/scroll-container-context'
import { useCognitivePhase } from '@/lib/cognitive-context'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'

const PHASE_SPRINGS: Record<string, { stiffness: number; damping: number; mass: number }> = {
  PEAK_FOCUS:            { stiffness: 380, damping: 28, mass: 0.8 },
  LINEAR_EXECUTION:      { stiffness: 280, damping: 30, mass: 1 },
  SYNAPTIC_FATIGUE:      { stiffness: 180, damping: 35, mass: 1.3 },
  REDUCED_CAPACITY_MODE: { stiffness: 140, damping: 40, mass: 1.5 },
}

// ─── Variants ───────────────────────────────────────────────────────────────
const variants = {
  enter: (dir: 'forward' | 'back') => ({
    x: dir === 'forward' ? '100vw' : '-10vw',
    scale: dir === 'forward' ? 1 : 0.98,
    opacity: dir === 'forward' ? 1 : 0,
  }),
  center: {
    x: 0,
    scale: 1,
    opacity: 1,
  },
  exit: (dir: 'forward' | 'back') => ({
    x: dir === 'forward' ? '-10vw' : '100vw',
    scale: dir === 'forward' ? 0.98 : 1,
    opacity: 0,
  }),
}

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  isFullScreen?: boolean
}

export function PageWrapper({ children, className, isFullScreen = false }: PageWrapperProps) {
  const pathname = usePathname() ?? '/'
  const { setScrollContainer } = useScrollContainer()
  let phase = 'LINEAR_EXECUTION'
  try { phase = useCognitivePhase() } catch {}
  const SPRING = useMemo(() => ({
    type: 'spring' as const,
    ...(PHASE_SPRINGS[phase] || PHASE_SPRINGS.LINEAR_EXECUTION),
  }), [phase])

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [prevPath, setPrevPath] = useState(pathname)
  const historyStack = useRef<string[]>([pathname])

  // Detect navigation direction via history stack
  useEffect(() => {
    if (pathname === prevPath) return
    const idx = historyStack.current.indexOf(pathname)
    if (idx !== -1 && idx < historyStack.current.length - 1) {
      setDirection('back')
      historyStack.current = historyStack.current.slice(0, idx + 1)
    } else {
      setDirection('forward')
      historyStack.current.push(pathname)
    }
    setPrevPath(pathname)
  }, [pathname, prevPath])

  // Register scroll container
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node
      if (!isFullScreen && node) {
        setScrollContainer(node)
      } else {
        setScrollContainer(null)
      }
    },
    [isFullScreen, setScrollContainer]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => setScrollContainer(null)
  }, [setScrollContainer])

  return (
    <AnimatePresence initial={false} custom={direction}>
      <motion.div
        key={pathname}
        ref={setRef}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={SPRING}
        className={cn(
          'w-full h-full flex flex-col min-h-0 absolute inset-0',
          isFullScreen
            ? 'overflow-hidden'
            : 'overflow-y-auto overflow-x-hidden scrollbar-hide',
          className
        )}
        onAnimationComplete={() => {
          const el = scrollRef.current
          if (el) el.style.transform = 'none'
        }}
      >
        {isFullScreen ? (
          <div className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <SmoothScrollProvider scrollElement={scrollRef.current}>
            {/* pb-40 (not pb-24): GeminiLiveOrb (components/ai/GeminiLiveOrb.tsx)
                floats fixed at bottom:5rem with a 56px button — its top edge
                sits ~136px above the viewport bottom, which pb-24 (96px)
                doesn't clear, so it overlapped the last visible content on
                pages like /checklist and /business. md:pb-8 is unchanged —
                the orb isn't a clearance problem at desktop's larger heights. */}
            <div className="container py-6 px-4 md:py-8 md:px-6 lg:px-8 pb-40 md:pb-8 flex-1 w-full">
              {children}
            </div>
          </SmoothScrollProvider>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
