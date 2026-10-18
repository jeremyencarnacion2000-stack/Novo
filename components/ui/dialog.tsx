'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'
import { useNativeDialogMotion, type NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'
import { useSharedDialogMotion } from '@/hooks/use-shared-dialog-motion'
import { readModalOrigin, rememberModalOrigin, restoreModalOriginFocus } from '@/lib/modal-origin'
import type { ModalOrigin } from '@/lib/liquid-modal-motion'
import {
  resolveModalMotionPreset,
  type ModalMobilePresentation,
  type ModalMotionPreset,
} from '@/lib/modal-motion'

type DialogMotionContextValue = {
  registerController: (controller: NativeDialogMotionController | null) => void
  originRef: React.RefObject<ModalOrigin>
}

const DialogMotionContext = React.createContext<DialogMotionContextValue | null>(null)

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  onExitComplete,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { onExitComplete?: () => void }) {
  const [present, setPresent] = React.useState(open ?? defaultOpen ?? false)
  const controllerRef = React.useRef<NativeDialogMotionController | null>(null)
  const previousOpenRef = React.useRef(open)
  const closingRef = React.useRef(false)
  const exitCompleteRef = React.useRef(onExitComplete)
  exitCompleteRef.current = onExitComplete
  const originRef = React.useRef(readModalOrigin())
  const retainedChildren = React.useRef(props.children)
  if (open !== false || !present) retainedChildren.current = props.children

  const registerController = React.useCallback((controller: NativeDialogMotionController | null) => {
    controllerRef.current = controller
  }, [])

  const finishClose = React.useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const complete = () => {
      closingRef.current = false
      setPresent(false)
      exitCompleteRef.current?.()
    }
    const controller = controllerRef.current
    if (controller) controller.close(complete)
    else complete()
  }, [])

  React.useLayoutEffect(() => {
    if (open === undefined) return
    const wasOpen = previousOpenRef.current
    previousOpenRef.current = open
    if (open) {
      closingRef.current = false
      if (wasOpen === false && !present) originRef.current = readModalOrigin()
      if (!present) setPresent(true)
      else if (wasOpen === false) controllerRef.current?.open()
      return
    }
    if (wasOpen === true && present) finishClose()
  }, [finishClose, open, present])

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      closingRef.current = false
      if (!present) originRef.current = readModalOrigin()
      setPresent(true)
      onOpenChange?.(true)
      return
    }
    if (!closingRef.current) { onOpenChange?.(false); finishClose() }
  }, [finishClose, onOpenChange, present])

  const context = React.useMemo(() => ({ registerController, originRef }), [registerController])

  return (
    <DialogMotionContext.Provider value={context}>
      <DialogPrimitive.Root
        data-slot="dialog"
        {...props}
        open={present}
        onOpenChange={handleOpenChange}
      >{retainedChildren.current}</DialogPrimitive.Root>
    </DialogMotionContext.Provider>
  )
}

function DialogTrigger({
  onPointerDown, onClick,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props}
    onPointerDown={(event) => { rememberModalOrigin(event.currentTarget); onPointerDown?.(event) }}
    onClick={(event) => { rememberModalOrigin(event.currentTarget); onClick?.(event) }} />
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
        'novo-dialog-overlay fixed inset-0 z-[5000]',
        isMaterialOverlay ? 'novo-material-overlay' : 'bg-black/60',
        isFlipModal
          ? 'modal-flip-overlay'
          : !isMaterialOverlay && 'backdrop-blur-sm',
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
    // Freeze the trigger-relative placement for the dialog lifetime. Observing
    // the surface itself made async fields, validation messages, and font
    // settling visibly move the whole modal after its entrance had completed.
    // Viewport changes still re-clamp it so rotation/resizing remains safe.
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
    }

    // Now that it's placed, measure its real size and clamp to the viewport
    // — flipping above the trigger if there's no room below.
  }, [flipId])

  return (
    <div
      ref={ref}
      data-modal-positioner
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
  motionPreset,
  motionId,
  mobilePresentation = 'inherit',
  anchorRef,
  overlayClassName,
  overlayProps,
  onCloseAutoFocus,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Anchor near the trigger instead of centering — for small, single-purpose dialogs. */
  flipAnchored?: boolean
  contextualRect?: DOMRect | null
  motionPreset?: ModalMotionPreset
  motionId?: string
  mobilePresentation?: ModalMobilePresentation
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Extra styling/attributes for the shared backdrop. */
  overlayClassName?: string
  overlayProps?: React.ComponentProps<typeof DialogPrimitive.Overlay> & Record<string, unknown>
}) {
  const legacyMotionId = (props as any)['data-flip-to'] as string | undefined
  const flipId = motionId ?? legacyMotionId
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const resolvedPreset = resolveModalMotionPreset({
    preset: motionPreset,
    legacyMotionId: flipId,
    flipAnchored,
    mobilePresentation,
    isMobile,
  })
  const isFlipModal = Boolean(flipId)
  const isIntegratedFlipModal = Boolean(motionId) && isFlipModal
  const resolvedAnchorRect = anchorRef?.current?.getBoundingClientRect() ?? contextualRect
  const isContextualModal = resolvedPreset === 'anchored' && Boolean(resolvedAnchorRect)
  const isMaterialOverlay = Boolean((props as any)['data-overlay-material'])
  const motionContext = React.useContext(DialogMotionContext)
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const [surfaceElement, setSurfaceElement] = React.useState<HTMLDivElement | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
    element: surfaceElement,
    enabled: resolvedPreset === 'sheet',
    onDismiss: (surface) => surface.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click(),
  })

  React.useImperativeHandle(forwardedRef, () => surfaceRef.current as HTMLDivElement)
  const setSurfaceRef = React.useCallback((node: HTMLDivElement | null) => {
    surfaceRef.current = node
    setSurfaceElement(node)
    dragSurfaceRef.current = node
  }, [dragSurfaceRef])

  useNativeDialogMotion({
    surfaceRef,
    surfaceElement,
    overlayRef,
    preset: resolvedPreset,
    enabled: !isFlipModal,
    registerController: motionContext?.registerController,
    originRef: motionContext?.originRef,
    anchorRef,
    contextualRect,
  })
  useSharedDialogMotion({
    surfaceRef,
    motionId: flipId ?? '',
    enabled: isIntegratedFlipModal && Boolean(surfaceElement),
    registerController: motionContext?.registerController,
    originRef: motionContext?.originRef,
  })

  const content = (
    <DialogPrimitive.Content
      ref={setSurfaceRef}
      data-slot="dialog-content"
      data-modal-motion={resolvedPreset}
      {...(flipId ? { 'data-flip-to': flipId } : {})}
      aria-describedby={undefined}
      className={cn(
        // max-h uses dvh, not vh: on mobile, vh is computed against the
        // layout viewport (address bar hidden), which is taller than what's
        // actually visible. A dialog forced to exactly that height, centered
        // in a non-scrolling wrapper, gets cropped equally from top and
        // bottom with no way to scroll to the cropped part. dvh tracks the
        // real visual viewport instead.
        'novo-modal-surface bg-background pointer-events-auto relative box-border w-full max-w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto gap-4 rounded-3xl border p-6 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)] sm:max-w-lg',
        isFlipModal
          ? 'modal-flip-target'
          : isContextualModal
            ? 'contextual-modal-target'
            : '',
        resolvedPreset === 'sheet' && 'max-w-none rounded-b-none rounded-t-[30px] border-b-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg',
        resolvedPreset === 'fullscreen' && 'h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-[34px] sm:border',
        className,
      )}
      {...props}
      onCloseAutoFocus={(event) => { onCloseAutoFocus?.(event); restoreModalOriginFocus(event, anchorRef?.current ?? motionContext?.originRef.current.element) }}
    >
      <MobileDialogDragHandle />
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-full p-1.5 opacity-70 transition-[background-color,color,opacity,transform] hover:opacity-100 hover:bg-foreground/10 active:scale-95 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
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
        ref={overlayRef}
        className={cn(
          resolvedPreset === 'anchored' ? 'bg-transparent backdrop-blur-none' : undefined,
          overlayClassName,
        )}
        {...(isFlipModal ? { 'data-flip-overlay': flipId } as any : {})}
        {...(isMaterialOverlay ? { 'data-overlay-material': true } as any : {})}
        {...overlayProps}
      />
      {isFlipModal && flipAnchored === true ? (
        <FlipAnchoredPositioner flipId={flipId!}>{content}</FlipAnchoredPositioner>
      ) : (
        <div
          data-modal-positioner
          className={cn(
            "fixed inset-0 z-[5001] pointer-events-none",
            isContextualModal
              ? "flex items-start justify-start"
              : resolvedPreset === 'sheet'
                ? 'flex items-end justify-center'
                : "flex items-center justify-center",
          )}
          style={isContextualModal && resolvedAnchorRect ? (() => {
            // Clamp against the dialog's actual CSS bounds rather than a
            // magic width/height. The old constants allowed a 28rem panel to
            // hang 16px off the right edge on desktop and tall content to be
            // cropped below the visual viewport on mobile.
            const viewportWidth = typeof window !== 'undefined'
              ? (window.visualViewport?.width ?? window.innerWidth)
              : 640
            const viewportHeight = typeof window !== 'undefined'
              ? (window.visualViewport?.height ?? window.innerHeight)
              : 800
            const margin = 12
            const maxPanelWidth = Math.min(448, Math.max(0, viewportWidth - margin * 2))
            const maxPanelHeight = Math.max(0, viewportHeight * 0.9)
            const maxLeft = Math.max(margin, viewportWidth - maxPanelWidth - margin)
            const maxTop = Math.max(margin, viewportHeight - maxPanelHeight - margin)

            return {
              paddingLeft: Math.max(margin, Math.min(resolvedAnchorRect.left, maxLeft)),
              paddingTop: Math.max(margin, Math.min(resolvedAnchorRect.top, maxTop)),
            }
          })() : undefined}
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
