'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface NovoSkeletonProps {
  className?: string
  variant?: 'text' | 'circle' | 'rect' | 'card'
  width?: string | number
  height?: string | number
}

export function NovoSkeleton({
  className,
  variant = 'rect',
  width,
  height,
}: NovoSkeletonProps) {
  const isCircle = variant === 'circle'
  const isText = variant === 'text'
  const isCard = variant === 'card'

  if (isCard) {
    return (
      <motion.div
        className={cn(
          "rounded-2xl border border-white/[0.04] p-5 space-y-4 overflow-hidden relative",
          "bg-gradient-to-r from-zinc-950/80 via-zinc-900/60 to-zinc-950/80",
          className
        )}
        animate={{ opacity: [0.45, 0.75, 0.45] }}
        transition={{
          repeat: Infinity,
          duration: 1.8,
          ease: "easeInOut",
        }}
        style={{ width, height, willChange: 'opacity' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="h-4 bg-zinc-800/80 rounded w-2/3" />
          <div className="h-4 bg-zinc-800/40 rounded w-1/4" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-800/60 rounded w-5/6" />
          <div className="h-3 bg-zinc-800/40 rounded w-1/2" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="h-7 bg-zinc-800/40 rounded flex-1" />
          <div className="h-7 bg-zinc-800/40 rounded w-7" />
          <div className="h-7 bg-zinc-800/40 rounded w-7" />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-white/[0.03]",
        isCircle ? "rounded-full" : isText ? "rounded h-3 w-full" : "rounded-xl",
        className
      )}
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{
        repeat: Infinity,
        duration: 1.8,
        ease: "easeInOut",
      }}
      style={{ width, height, willChange: 'opacity' }}
    />
  )
}
