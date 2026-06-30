'use client'

import { motion } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...springConfig.gentle, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
