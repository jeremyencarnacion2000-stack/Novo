'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useNativeDialogMotion, type NativeDialogMotionController } from '@/hooks/use-native-dialog-motion'

const AlertMotionContext = React.createContext<{
  registerController: (controller: NativeDialogMotionController | null) => void
} | null>(null)

function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  const [present, setPresent] = React.useState(open ?? defaultOpen ?? false)
  const controllerRef = React.useRef<NativeDialogMotionController | null>(null)
  const previousOpenRef = React.useRef(open)
  const registerController = React.useCallback((controller: NativeDialogMotionController | null) => {
    controllerRef.current = controller
  }, [])
  const finishClose = React.useCallback((notify: boolean) => {
    const complete = () => {
      setPresent(false)
      if (notify) onOpenChange?.(false)
    }
    const controller = controllerRef.current
    if (controller) controller.close(complete)
    else complete()
  }, [onOpenChange])

  React.useLayoutEffect(() => {
    if (open === undefined) return
    const wasOpen = previousOpenRef.current
    previousOpenRef.current = open
    if (open) {
      if (!present) setPresent(true)
      else if (wasOpen === false) controllerRef.current?.open()
    } else if (wasOpen === true && present) {
      finishClose(false)
    }
  }, [finishClose, open, present])

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setPresent(true)
      onOpenChange?.(true)
    } else {
      finishClose(true)
    }
  }, [finishClose, onOpenChange])
  const context = React.useMemo(() => ({ registerController }), [registerController])

  return (
    <AlertMotionContext.Provider value={context}>
      <AlertDialogPrimitive.Root {...props} data-slot="alert-dialog" open={present} onOpenChange={handleOpenChange} />
    </AlertMotionContext.Provider>
  )
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
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
  ref: forwardedRef,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const motionContext = React.useContext(AlertMotionContext)
  React.useImperativeHandle(forwardedRef, () => surfaceRef.current as HTMLDivElement)
  useNativeDialogMotion({
    surfaceRef,
    overlayRef,
    preset: 'alert',
    enabled: true,
    registerController: motionContext?.registerController,
  })

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay ref={overlayRef} />
      <AlertDialogPrimitive.Content
        ref={surfaceRef}
        data-slot="alert-dialog-content"
        aria-describedby={undefined}
        className={cn(
          'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[26px] border p-6 shadow-lg sm:max-w-lg',
          className,
        )}
        {...props}
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
