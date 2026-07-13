'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NovoEmptyStateProps {
  className?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export function NovoEmptyState({
  className,
  message,
  actionLabel = "Breathe",
  onAction,
  icon,
}: NovoEmptyStateProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className={cn(
        "relative rounded-2xl border border-foreground/[0.05] p-8 text-center flex flex-col items-center justify-center gap-4 overflow-hidden transition-all duration-700",
        "bg-gradient-to-b from-foreground/[0.01] to-transparent backdrop-blur-md",
        className
      )}
      style={{
        boxShadow: isHovered 
          ? "0 20px 40px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)" 
          : "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slow-moving breathing radial ambient aura gradient */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.05)_0%,transparent_70%)] opacity-80 pointer-events-none"
        style={{
          transform: isHovered ? "scale(1.15)" : "scale(1.0)",
          transition: "transform 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
        }}
      />

      {/* Decorative moving light ring element */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 border border-violet-500/10 rounded-2xl pointer-events-none"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Atmospheric Icon */}
      <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-xl bg-foreground/[0.02] border border-foreground/[0.05] text-zinc-500 mb-1">
        {icon || <Sparkles className="w-4.5 h-4.5 stroke-[1.2] text-zinc-400/70" strokeWidth={1.2} />}
      </div>

      {/* Atmospheric Microcopy */}
      <p className="relative z-10 text-xs text-zinc-400 font-medium tracking-wide leading-relaxed max-w-[280px] select-none">
        {message}
      </p>

      {/* Minimalist elastic breathe trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        onClick={onAction}
        className={cn(
          "relative z-10 mt-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-500",
          isHovered
            ? "bg-violet-500/15 border-violet-500/30 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
            : "bg-foreground/[0.03] border-foreground/10 text-zinc-400 hover:text-foreground"
        )}
      >
        {actionLabel}
      </motion.button>
    </motion.div>
  )
}
