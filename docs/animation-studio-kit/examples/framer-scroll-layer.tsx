import { motion, useTransform, type MotionValue } from 'framer-motion'

type ScrollLayerProps = {
  progress: MotionValue<number>
  reduceMotion: boolean | null
  children: React.ReactNode
}

/**
 * Reference recipe for a single composited depth plane.
 * Copy the pattern into a real landing component; do not import this file in
 * production without adapting the class names and semantic content.
 */
export function FramerScrollLayer({ progress, reduceMotion, children }: ScrollLayerProps) {
  const y = useTransform(progress, [0, 1], [0, -180])
  const opacity = useTransform(progress, [0, 0.12, 0.9, 1], [0, 1, 1, 0.84])

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 will-change-transform"
      style={reduceMotion ? undefined : { y, opacity }}
    >
      {children}
    </motion.div>
  )
}
