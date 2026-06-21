'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

export type IconState =
  | 'sync'
  | 'recovery'
  | 'execution'
  | 'prediction'
  | 'upload'
  | 'download'
  | 'voice'
  | 'thinking'
  | 'calendar'
  | 'notification'
  | 'search'
  | 'microphone'
  | 'clock'

export interface AnimatedSVGIconProps extends Omit<HTMLMotionProps<'svg'>, 'state'> {
  state: IconState
  size?: number
  color?: string
}

export const AnimatedSVGIcon = React.forwardRef<SVGSVGElement, AnimatedSVGIconProps>(
  ({ state, size = 24, color = 'currentColor', className, ...props }, ref) => {
    // Shared sub-component SVG structures with internal physics-based motion.
    const renderIconContent = () => {
      switch (state) {
        case 'sync':
          // Rotating wave: circular arrow + inner rotating orbital elements
          return (
            <g>
              <motion.path
                d="M 12 4 A 8 8 0 0 1 20 12"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              />
              <motion.path
                d="M 12 20 A 8 8 0 0 1 4 12"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ rotate: -360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              />
              <motion.circle
                cx="12"
                cy="12"
                r="3"
                fill={color}
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )

        case 'recovery':
          // Breathing motion: overlapping soft shields or rings pulsing gently
          return (
            <g>
              <motion.path
                d="M 12 3 L 20 6.5 V 12 C 20 17 16.5 20.5 12 21.5 C 7.5 20.5 4 17 4 12 V 6.5 L 12 3 Z"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: '12px', originY: '12px' }}
              />
              <motion.path
                d="M 9 12 L 11 14 L 15 10"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )

        case 'execution':
          // Forward flowing path: dash arrays sliding dynamically representing momentum
          return (
            <g>
              <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <motion.path
                d="M 4 8 L 12 12 L 4 16"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.path
                d="M 12 8 L 20 12 L 12 16"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              />
            </g>
          )

        case 'prediction':
          // Particle convergence: floating points sliding into a central core
          return (
            <g>
              <circle cx="12" cy="12" r="3.5" fill={color} />
              {/* Convergence points */}
              <motion.circle
                cx="12"
                cy="12"
                r="1.5"
                fill={color}
                animate={{ y: [-8, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.circle
                cx="12"
                cy="12"
                r="1.5"
                fill={color}
                animate={{ y: [8, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              />
              <motion.circle
                cx="12"
                cy="12"
                r="1.5"
                fill={color}
                animate={{ x: [-8, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
              />
              <motion.circle
                cx="12"
                cy="12"
                r="1.5"
                fill={color}
                animate={{ x: [8, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
              />
            </g>
          )

        case 'upload':
          // Path growth: bottom bar + arrow growing/sliding up
          return (
            <g>
              <path d="M 4 20 H 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <motion.path
                d="M 12 16 V 4 M 12 4 L 7 9 M 12 4 L 17 9"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{
                  y: [4, -1, 4],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )

        case 'download':
          // Reverse growth: top bar + arrow sliding down
          return (
            <g>
              <path d="M 4 4 H 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <motion.path
                d="M 12 8 V 20 M 12 20 L 7 15 M 12 20 L 17 15"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{
                  y: [-3, 2, -3],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )

        case 'voice':
          // Wave oscillation: horizontal wave bars jumping at vocal frequencies
          return (
            <g>
              {[6, 9, 12, 15, 18].map((x, i) => {
                const heights = [
                  [6, 16, 6],
                  [8, 18, 8],
                  [10, 22, 10],
                  [8, 18, 8],
                  [6, 16, 6],
                ]
                return (
                  <motion.line
                    key={x}
                    x1={x}
                    x2={x}
                    y1="12"
                    y2="12"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    animate={{
                      y1: heights[i].map((h) => 12 - h / 2),
                      y2: heights[i].map((h) => 12 + h / 2),
                    }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.1,
                    }}
                  />
                )
              })}
            </g>
          )

        case 'thinking':
          // Soft orbital rotation: nested dots rotating in cosmic orbit
          return (
            <g>
              {/* Central node */}
              <circle cx="12" cy="12" r="2.5" fill={color} />
              {/* Outer orbits */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              >
                <circle cx="12" cy="5" r="2" fill={color} opacity="0.9" />
              </motion.g>
              <motion.g
                animate={{ rotate: -360 }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              >
                <circle cx="6" cy="12" r="1.5" fill={color} opacity="0.6" />
                <circle cx="18" cy="12" r="1.5" fill={color} opacity="0.6" />
              </motion.g>
            </g>
          )

        case 'calendar':
          // Circular orbit around a grid
          return (
            <g>
              <rect
                x="5"
                y="5"
                width="14"
                height="14"
                rx="3"
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
              <line x1="5" y1="10" x2="19" y2="10" stroke={color} strokeWidth="1.5" />
              <circle cx="9" cy="14" r="1.2" fill={color} />
              <circle cx="15" cy="14" r="1.2" fill={color} />
              {/* Orbiting sync ring */}
              <motion.path
                d="M 12 2 A 10 10 0 0 1 22 12"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4 4"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              />
            </g>
          )

        case 'notification':
          // Pulse propagation: vibrating bell + soft concentric rings
          return (
            <g>
              <motion.path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ rotate: [-8, 8, -8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: '12px', originY: '3px' }}
              />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" fill={color} />
              {/* Radiant ring */}
              <motion.circle
                cx="12"
                cy="11"
                r="9"
                fill="none"
                stroke={color}
                strokeWidth="1"
                animate={{ scale: [0.7, 1.3], opacity: [0.8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                style={{ originX: '12px', originY: '11px' }}
              />
            </g>
          )

        case 'search':
          // Expanding lens: handles micro slide + expanding glass frame
          return (
            <g>
              <motion.circle
                cx="10"
                cy="10"
                r="6"
                fill="none"
                stroke={color}
                strokeWidth="2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: '10px', originY: '10px' }}
              />
              <motion.line
                x1="14.5"
                y1="14.5"
                x2="20"
                y2="20"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ x: [0, 1.5, 0], y: [0, 1.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )

        case 'microphone':
          // Frequency waves floating around microphone body
          return (
            <g>
              <rect x="9" y="5" width="6" height="10" rx="3" fill="none" stroke={color} strokeWidth="2" />
              <path d="M5 10a7 7 0 0 0 14 0" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" />
              {/* Left/right frequency curves */}
              <motion.path
                d="M 2 10 A 10 10 0 0 1 4 6"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.path
                d="M 22 10 A 10 10 0 0 0 20 6"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              />
            </g>
          )

        case 'clock':
          // Continuous sweep hands
          return (
            <g>
              <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
              {/* Hour hand */}
              <motion.line
                x1="12"
                y1="12"
                x2="12"
                y2="7"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              />
              {/* Minute hand */}
              <motion.line
                x1="12"
                y1="12"
                x2="12"
                y2="5"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ originX: '12px', originY: '12px' }}
              />
            </g>
          )

        default:
          return null
      }
    }

    return (
      <motion.svg
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {renderIconContent()}
      </motion.svg>
    )
  }
)

AnimatedSVGIcon.displayName = 'AnimatedSVGIcon'
