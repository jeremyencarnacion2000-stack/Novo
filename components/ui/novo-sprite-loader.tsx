'use client'

import { cn } from '@/lib/utils'

interface NovoSpriteLoaderProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeClasses = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-32 sm:size-36',
}

export function NovoSpriteLoader({
  className,
  size = 'md',
  label,
}: NovoSpriteLoaderProps) {
  return (
    <div
      className={cn('inline-flex flex-col items-center gap-3', className)}
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
    >
      <span
        aria-hidden
        className={cn('novo-sprite-loader shrink-0', sizeClasses[size])}
      >
        <span className="novo-sprite-sheet" />
      </span>
      {label ? (
        <span className="max-w-64 text-center text-[11px] font-semibold tracking-[0.08em] text-current/60">
          {label}
        </span>
      ) : null}
    </div>
  )
}
