'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useNativeDialogMotion, type NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'
import { readModalOrigin, rememberModalOrigin, restoreModalOriginFocus } from '@/lib/modal-origin'
import type { ModalOrigin } from '@/lib/liquid-modal-motion'

const AlertMotionContext = React.createContext<{
  registerController: (controller: NativeDialogMotionController | null) => void
  originRef: React.RefObject<ModalOrigin>
} | null>(null)

function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  motionOrigin,
  onExitComplete,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root> & { motionOrigin?: ModalOrigin; onExitComplete?: () => void }) {
  const [present, setPresent] = React.useState(open ?? defaultOpen ?? false)
  const controllerRef = React.useRef<NativeDialogMotionController | null>(null)
  const previousOpenRef = React.useRef(open)
  const closingRef = React.useRef(false)
  const exitCompleteRef = React.useRef(onExitComplete)
  exitCompleteRef.current = onExitComplete
  const originRef = React.useRef(motionOrigin ?? readModalOrigin())
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
      if (wasOpen === false && !present) originRef.current = motionOrigin ?? readModalOrigin()
      if (!present) setPresent(true)
      else if (wasOpen === false) controllerRef.current?.open()
    } else if (wasOpen === true && present) {
      finishClose()
    }
  }, [finishClose, open, present])

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      closingRef.current = false
      if (!present) originRef.current = motionOrigin ?? readModalOrigin()
      setPresent(true)
      onOpenChange?.(true)
    } else {
      if (!closingRef.current) { onOpenChange?.(false); finishClose() }
    }
  }, [finishClose, onOpenChange, motionOrigin, present])
  const context = React.useMemo(() => ({ registerController, originRef }), [registerController])

  return (
    <AlertMotionContext.Provider value={context}>
      <AlertDialogPrimitive.Root {...props} data-slot="alert-dialog" open={present} onOpenChange={handleOpenChange}>{retainedChildren.current}</AlertDialogPrimitive.Root>
    </AlertMotionContext.Provider>
  )
}

function AlertDialogTrigger({
  onPointerDown, onClick,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props}
      onPointerDown={(event) => { rememberModalOrigin(event.currentTarget); onPointerDown?.(event) }}
      onClick={(event) => { rememberModalOrigin(event.currentTarget); onClick?.(event) }} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 opacity-0',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  onCloseAutoFocus,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const [surfaceElement, setSurfaceElement] = React.useState<HTMLDivElement | null>(null)
  const setSurfaceRef = React.useCallback((node: HTMLDivElement | null) => { surfaceRef.current = node; setSurfaceElement(node) }, [])
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const motionContext = React.useContext(AlertMotionContext)
  React.useImperativeHandle(forwardedRef, () => surfaceRef.current as HTMLDivElement)
  useNativeDialogMotion({
    surfaceRef,
    surfaceElement,
    overlayRef,
    preset: 'alert',
    enabled: true,
    registerController: motionContext?.registerController,
    originRef: motionContext?.originRef,
  })

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay ref={overlayRef} />
      <AlertDialogPrimitive.Content
        ref={setSurfaceRef}
        data-slot="alert-dialog-content"
        className={cn(
          'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[26px] border p-6 shadow-lg sm:max-w-lg',
          className,
        )}
        {...props}
        onCloseAutoFocus={(event) => { onCloseAutoFocus?.(event); restoreModalOriginFocus(event, motionContext?.originRef.current.element) }}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
