import { motion, useTransform, type MotionValue } from 'framer-motion'

type DrawnPathProps = {
  progress: MotionValue<number>
  reduceMotion: boolean | null
}

/** Reference for a path that explains a relationship instead of decorating it. */
export function DrawnPath({ progress, reduceMotion }: DrawnPathProps) {
  const pathLength = useTransform(progress, [0.18, 0.48], [0, 1])

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 640 360"
      preserveAspectRatio="none"
    >
      <motion.path
        d="M 120 180 C 260 90, 360 260, 520 150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="5 8"
        vectorEffect="non-scaling-stroke"
        style={reduceMotion ? { pathLength: 1 } : { pathLength }}
      />
    </svg>
  )
}
