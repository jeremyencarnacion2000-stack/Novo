'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'
import { useNativeDialogMotion, type NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'
import { readModalOrigin, rememberModalOrigin, restoreModalOriginFocus } from '@/lib/modal-origin'
import type { ModalOrigin } from '@/lib/liquid-modal-motion'

const SheetMotionContext = React.createContext<{
  registerController: (controller: NativeDialogMotionController | null) => void
  originRef: React.RefObject<ModalOrigin>
} | null>(null)

function MobileSheetDragHandle({ side }: { side: string }) {
  if (side !== 'bottom') return null
  return (
    <div
      aria-hidden="true"
      className="flex justify-center pt-3 pb-1 select-none pointer-events-none shrink-0"
    >
      <div className="w-10 h-[5px] rounded-full bg-foreground/20 hover:bg-foreground/40 transition-colors" />
    </div>
  )
}

function Sheet({ open, defaultOpen, onOpenChange, onExitComplete, ...props }: React.ComponentProps<typeof SheetPrimitive.Root> & { onExitComplete?: () => void }) {
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
    } else if (wasOpen === true && present) {
      finishClose()
    }
  }, [finishClose, open, present])

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      closingRef.current = false
      if (!present) originRef.current = readModalOrigin()
      setPresent(true)
      onOpenChange?.(true)
    } else {
      if (!closingRef.current) { onOpenChange?.(false); finishClose() }
    }
  }, [finishClose, onOpenChange, present])

  const context = React.useMemo(() => ({ registerController, originRef }), [registerController])
  return (
    <SheetMotionContext.Provider value={context}>
      <SheetPrimitive.Root {...props} data-slot="sheet" open={present} onOpenChange={handleOpenChange}>{retainedChildren.current}</SheetPrimitive.Root>
    </SheetMotionContext.Provider>
  )
}

function SheetTrigger({
  onPointerDown, onClick,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props}
    onPointerDown={(event) => { rememberModalOrigin(event.currentTarget); onPointerDown?.(event) }}
    onClick={(event) => { rememberModalOrigin(event.currentTarget); onClick?.(event) }} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 opacity-0',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  overlayClassName,
  overlayProps,
  onCloseAutoFocus,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  showCloseButton?: boolean
  /** Extra styling/attributes for the shared backdrop (useful for responsive shells). */
  overlayClassName?: string
  overlayProps?: React.ComponentProps<typeof SheetPrimitive.Overlay> & Record<string, unknown>
}) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const [surfaceElement, setSurfaceElement] = React.useState<HTMLDivElement | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  React.useImperativeHandle(forwardedRef, () => surfaceRef.current as HTMLDivElement)
  const motionContext = React.useContext(SheetMotionContext)
  const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
    element: surfaceElement,
    enabled: side === 'bottom',
    onDismiss: (surface) => surface.querySelector<HTMLElement>('[data-slot="sheet-close"]')?.click(),
  })
  const setSurfaceRef = React.useCallback((node: HTMLDivElement | null) => {
    surfaceRef.current = node
    setSurfaceElement(node)
    dragSurfaceRef.current = node
  }, [dragSurfaceRef])

  useNativeDialogMotion({
    surfaceRef,
    surfaceElement,
    overlayRef,
    preset: 'sheet',
    sheetSide: side,
    enabled: true,
    registerController: motionContext?.registerController,
    originRef: motionContext?.originRef,
  })

  return (
    <SheetPortal>
      <SheetOverlay ref={overlayRef} className={overlayClassName} {...overlayProps} />
      <SheetPrimitive.Content
        ref={setSurfaceRef}
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          // Keep the sheet itself as the scroll boundary. Without an internal
          // overflow region, long app forms (especially on mobile) extend
          // below the visual viewport and leave the primary action unreachable.
          // `min-h-0` lets the flex item actually shrink before scrolling.
          'bg-background fixed z-50 flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain shadow-lg will-change-transform',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' &&
            'inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'inset-x-0 bottom-0 h-auto border-t rounded-t-3xl',
          className,
        )}
        {...props}
        onCloseAutoFocus={(event) => { onCloseAutoFocus?.(event); restoreModalOriginFocus(event, motionContext?.originRef.current.element) }}
      >
        <MobileSheetDragHandle side={side} />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-full p-1.5 opacity-70 transition-[background-color,color,opacity,transform] hover:opacity-100 hover:bg-foreground/10 active:scale-95 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
