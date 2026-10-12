'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion } from 'framer-motion'

import { cn } from '@/lib/utils'
import { getNovoMotionModeFromDOM, shouldReduceNovoMotion } from '@/hooks/use-novo-motion-policy'
import { appleLiquidMotion } from '@/lib/design-tokens'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:     'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:   'h-9 px-4 py-2 has-[>svg]:px-3',
        sm:        'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg:        'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon:      'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    ripple?: boolean
  }

type Ripple = { id: number; x: number; y: number }

function Button({ className, variant, size, asChild = false, ripple = false, children, onPointerDown, ...props }: ButtonProps) {
  const isIcon = size === 'icon' || size === 'icon-sm' || size === 'icon-lg'
  const motionMode = getNovoMotionModeFromDOM()
  const [ripples, setRipples] = React.useState<Ripple[]>([])
  const nextRippleId = React.useRef(0)
  const rippleTimers = React.useRef<ReturnType<typeof setTimeout>[]>([])

  React.useEffect(() => () => rippleTimers.current.forEach(clearTimeout), [])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event)
    // Some synthetic PointerEvents (including JSDOM and assistive wrappers)
    // omit `button`; only reject an explicitly non-primary pointer.
    if (!ripple || event.defaultPrevented || (event.button !== undefined && event.button !== 0)) return
    if (shouldReduceNovoMotion()) return

    const rect = event.currentTarget.getBoundingClientRect()
    const id = nextRippleId.current++
    const x = Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2
    const y = Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2
    setRipples((current) => [...current.slice(-2), { id, x, y }])
    const timer = setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== id))
      rippleTimers.current = rippleTimers.current.filter((item) => item !== timer)
    }, 650)
    rippleTimers.current.push(timer)
  }

  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-variant={variant ?? 'default'}
        data-size={size ?? 'default'}
        className={cn(buttonVariants({ variant, size, className }))}
        onPointerDown={onPointerDown}
        {...props}
      >
        {children}
      </Slot>
    )
  }

  const hoverAnimation = motionMode === 'full'
    ? { scale: appleLiquidMotion.hoverScale, transition: appleLiquidMotion.pressTransition }
    : undefined
  const tapAnimation = motionMode === 'full'
    ? (isIcon
      ? { scale: appleLiquidMotion.pressScale, rotate: -3, transition: appleLiquidMotion.pressTransition }
      : { scale: appleLiquidMotion.pressScale, transition: appleLiquidMotion.pressTransition })
    : motionMode === 'reduced'
      ? { opacity: 0.82, transition: { duration: appleLiquidMotion.reducedDuration } }
      : undefined

  return (
    <motion.button
      data-slot="button"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      className={cn(buttonVariants({ variant, size, className }), ripple && 'relative isolate overflow-hidden')}
      onPointerDown={handlePointerDown}
      whileHover={hoverAnimation}
      whileTap={tapAnimation}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {ripple && (
        <AnimatePresence initial={false}>
          {ripples.map((item) => (
            <motion.span
              key={item.id}
              aria-hidden="true"
              className="pointer-events-none absolute z-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ripple-button-ripple-color,var(--primary-foreground))] opacity-30"
              style={{ left: item.x, top: item.y }}
              initial={{ scale: 0, opacity: 0.3 }}
              animate={{ scale: 10, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>
      )}
      <span className="relative z-[1] inline-flex items-center justify-center gap-[inherit]">
        {children}
      </span>
    </motion.button>
  )
}

export { Button, buttonVariants }
