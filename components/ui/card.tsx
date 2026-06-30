'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'

interface CardProps extends React.ComponentProps<'div'> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'liquid'
}

function Card({ className, style, variant = 'primary', children, ...props }: CardProps) {
  // `liquid` opts a hero/primary card into the real Liquid Glass renderer
  // (SVG displacement in backdrop-filter) instead of the CSS glassmorphism
  // surfaces. Use sparingly — it's GPU-heavier than .glass-surface.
  if (variant === 'liquid') {
    return (
      <GlassSurface
        data-slot="card"
        data-variant="liquid"
        radius={20}
        depth={8}
        blur={1}
        strength={50}
        chromaticAberration={8}
        elevation="medium"
        contrastObserver
        className={cn(
          'text-card-foreground gap-8 p-6 lg:p-10 transition-all duration-300',
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </GlassSurface>
    )
  }

  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        'text-card-foreground flex flex-col gap-8 rounded-card p-6 lg:p-10 relative isolate shadow-none bg-transparent overflow-hidden border transition-all duration-300',
        variant === 'primary' && 'glass-surface',
        variant === 'secondary' && 'glass-surface bg-white/[0.04]',
        variant === 'tertiary' && 'glass-surface bg-black/40 border-white/5',
        variant === 'ghost' && 'border-transparent',
        className,
      )}
      {...props}
      style={style}
    >
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-3 px-0 has-[data-[slot=card-action]]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-0', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-0 [.border-t]:pt-6', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
