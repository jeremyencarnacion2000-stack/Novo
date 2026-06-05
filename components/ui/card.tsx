'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.ComponentProps<'div'> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost'
}

function Card({ className, style, variant = 'primary', children, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        'text-card-foreground flex flex-col gap-8 rounded-[32px] p-6 lg:p-10 relative isolate shadow-none bg-transparent overflow-hidden',
        variant !== 'ghost' && 'glass-card',
        className,
      )}
      {...props}
      style={style}
    >
      {/* Glass Background & Blur */}
      {variant !== 'ghost' && (
        <div
          className={cn(
            "absolute inset-0 z-[-2] rounded-[32px] pointer-events-none",
            variant === 'primary' && "card-bg-primary",
            variant === 'secondary' && "card-bg-secondary",
            variant === 'tertiary' && "card-bg-tertiary",
          )}
        />
      )}
      {/* Children flow normally over the absolute background layers */}
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
