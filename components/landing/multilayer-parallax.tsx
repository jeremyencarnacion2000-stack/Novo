'use client'

import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

type MotionDivStyle = HTMLMotionProps<'div'>['style']

export type HeroSceneLayer = {
  id: string
  content: ReactNode
  className: string
  style?: MotionDivStyle
}

type LandingHeroParallaxProps = {
  reduceMotion: boolean | null
  layers: HeroSceneLayer[]
  narrative: ReactNode
  narrativeStyle?: MotionDivStyle
}

/**
 * An actual composited scene, rather than a single background that is merely
 * translated. Each supplied asset is an independently moving depth plane.
 * The ordered list is intentionally explicit: a Novo hero is a stack of scene
 * layers, not one visual behind a product card.
 * The parent owns motion values so the scene remains deterministic and has a
 * no-motion equivalent for accessibility.
 */
export function LandingHeroParallax({
  reduceMotion,
  layers,
  narrative,
  narrativeStyle,
}: LandingHeroParallaxProps) {
  return (
    <>
      {layers.map((layer) => (
        <motion.div
          key={layer.id}
          data-testid={`landing-hero-parallax-${layer.id}`}
          aria-hidden="true"
          className={`pointer-events-none absolute will-change-transform ${layer.className}`}
          style={reduceMotion ? undefined : layer.style}
        >
          {layer.content}
        </motion.div>
      ))}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(249,247,240,.62)_0%,rgba(249,247,240,.2)_46%,rgba(249,247,240,.06)_100%)] dark:bg-[linear-gradient(90deg,rgba(5,13,9,.6)_0%,rgba(5,13,9,.22)_46%,rgba(5,13,9,.08)_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-[8%] -z-10 size-[34rem] rounded-full bg-[#225D3A]/13 blur-[150px]" />
      <div className="pointer-events-none absolute right-[5%] top-[20%] -z-10 size-[28rem] rounded-full bg-[#ADEBC1]/[0.06] blur-[130px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[38%]"
        style={{ backgroundImage: 'linear-gradient(to bottom, transparent 0%, var(--landing-elevated) 100%)' }}
      />
      <div className="relative mx-auto w-full max-w-7xl">
        <motion.div
          data-testid="landing-hero-parallax-narrative"
          className="relative z-10 max-w-2xl will-change-transform"
          style={reduceMotion ? undefined : narrativeStyle}
        >
          {narrative}
        </motion.div>
      </div>
    </>
  )
}
