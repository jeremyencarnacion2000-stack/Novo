'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const isFlipModal = Boolean((props as any)['data-flip-overlay'])
  const isMaterialOverlay = Boolean((props as any)['data-overlay-material'])
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-[5000]',
        isMaterialOverlay ? 'novo-material-overlay' : 'bg-black/60',
        isFlipModal
          ? 'modal-flip-overlay'
          : cn(
              !isMaterialOverlay && 'backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            ),
        className,
      )}
      {...props}
    />
  )
}

// Anchors a flip-mode dialog near its trigger instead of centering it on
// screen — for small, single-purpose dialogs (a quick form, a confirmation)
// where jumping to the middle of the viewport reads as a bigger interruption
// than the content warrants. Runs before paint so modalFlip's own
// requestAnimationFrame (in the next frame) always reads a settled rect.
function FlipAnchoredPositioner({
  flipId,
  children,
}: {
  flipId: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [anchored, setAnchored] = React.useState(false)
  const [anchorPosition, setAnchorPosition] = React.useState({ left: 0, top: 0 })

  React.useLayoutEffect(() => {
    const wrapper = ref.current
    const origin = document.querySelector<HTMLElement>(`[data-flip-from="${flipId}"]`)
    if (!wrapper || !origin) {
      setAnchored(false)
      return
    }

    const margin = 16
    const gap = 8
    const surface = wrapper.firstElementChild as HTMLElement | null

    const place = () => {
      const originRect = origin.getBoundingClientRect()
      const rect = (surface ?? wrapper).getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const maxLeft = Math.max(margin, viewportWidth - rect.width - margin)
      const maxTop = Math.max(margin, viewportHeight - rect.height - margin)
      const left = Math.min(Math.max(margin, originRect.left), maxLeft)
      let top = originRect.bottom + gap
      if (top > maxTop) top = originRect.top - rect.height - gap
      top = Math.min(Math.max(margin, top), maxTop)
      wrapper.style.left = `${left}px`
      wrapper.style.top = `${top}px`
      setAnchorPosition({ left, top })
      setAnchored(true)
    }

    place()
    const resizeObserver = surface && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (resizeObserver && surface) resizeObserver.observe(surface)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
    }

    // Now that it's placed, measure its real size and clamp to the viewport
    // — flipping above the trigger if there's no room below.
  }, [flipId])

  return (
    <div
      ref={ref}
      className={cn(
        'fixed z-[5001] pointer-events-none',
        !anchored && 'inset-0 flex items-center justify-center',
      )}
      style={{ left: anchored ? anchorPosition.left : 0, top: anchored ? anchorPosition.top : 0 }}
    >
      {children}
    </div>
  )
}

function MobileDialogDragHandle() {
  return (
    <div
      aria-hidden="true"
      data-modal-drag-handle
      className="flex sm:hidden justify-center pt-3 pb-2 -mt-3 -mx-4 shrink-0 touch-none select-none"
    >
      <div className="w-9 h-[4px] rounded-full bg-foreground/20" />
    </div>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  flipAnchored,
  contextualRect,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Anchor near the trigger instead of centering — for small, single-purpose dialogs. */
  flipAnchored?: boolean
  contextualRect?: DOMRect | null
}) {
  const flipId = (props as any)['data-flip-to'] as string | undefined
  const isFlipModal = Boolean(flipId)
  const isContextualModal = Boolean(contextualRect)
  const isMaterialOverlay = Boolean((props as any)['data-overlay-material'])
  const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
    onDismiss: (surface) => surface.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click(),
  })

  const content = (
    <DialogPrimitive.Content
      ref={dragSurfaceRef}
      data-slot="dialog-content"
      aria-describedby={undefined}
      className={cn(
        // max-h uses dvh, not vh: on mobile, vh is computed against the
        // layout viewport (address bar hidden), which is taller than what's
        // actually visible. A dialog forced to exactly that height, centered
        // in a non-scrolling wrapper, gets cropped equally from top and
        // bottom with no way to scroll to the cropped part. dvh tracks the
        // real visual viewport instead.
        'bg-background pointer-events-auto relative box-border w-full max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto gap-4 rounded-3xl border p-6 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)] sm:max-w-lg',
        isFlipModal
          ? 'modal-flip-target'
          : isContextualModal
            ? 'contextual-modal-target'
          : 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:duration-[180ms] data-[state=open]:duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        className,
      )}
      {...props}
    >
      <MobileDialogDragHandle />
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-full p-1.5 opacity-70 transition-all hover:opacity-100 hover:bg-foreground/10 active:scale-95 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  )

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay
        {...(isFlipModal ? { 'data-flip-overlay': flipId } as any : {})}
        {...(isMaterialOverlay ? { 'data-overlay-material': true } as any : {})}
      />
      {isFlipModal && flipAnchored !== false ? (
        <FlipAnchoredPositioner flipId={flipId!}>{content}</FlipAnchoredPositioner>
      ) : (
        <div
          className={cn(
            "fixed inset-0 z-[5001] pointer-events-none",
            isContextualModal ? "flex items-start justify-start" : "flex items-center justify-center",
          )}
          style={isContextualModal && contextualRect ? {
            paddingLeft: Math.max(12, Math.min(contextualRect.left, (typeof window !== 'undefined' ? window.innerWidth : 640) - 432)),
            paddingTop: Math.max(12, Math.min(contextualRect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 180)),
          } : undefined}
        >
          {content}
        </div>
      )}
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
