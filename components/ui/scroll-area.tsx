'use client'

import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

import { cn } from '@/lib/utils'

interface ScrollAreaProps extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  horizontalWheel?: boolean
}

function ScrollArea({
  className,
  children,
  horizontalWheel,
  ...props
}: ScrollAreaProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (horizontalWheel && viewport) {
      const onWheel = (e: WheelEvent) => {
        // If there's any wheel movement, we handle it
        if (e.deltaY !== 0 || e.deltaX !== 0) {
          e.preventDefault()
          // Combine vertical and horizontal movement for horizontal scrolling
          const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX
          viewport.scrollTo({
            left: viewport.scrollLeft + scrollAmount,
            behavior: 'auto'
          })
        }
      }
      viewport.addEventListener('wheel', onWheel, { passive: false })
      return () => viewport.removeEventListener('wheel', onWheel)
    }
  }, [horizontalWheel])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' &&
        'h-2.5 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-white/20 hover:bg-white/40 transition-colors relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
