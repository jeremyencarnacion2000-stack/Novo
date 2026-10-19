'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cancelNovoConfirmations, finishNovoConfirmation, getNovoConfirmation, subscribeNovoConfirmations } from '@/lib/confirm-modal'

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const request = useSyncExternalStore(subscribeNovoConfirmations, getNovoConfirmation, () => null)
  const accepted = useRef(false)
  const [closingId, setClosingId] = useState<number | null>(null)
  const pathname = usePathname()
  useEffect(() => { cancelNovoConfirmations() }, [pathname])
  useEffect(() => { accepted.current = false }, [request?.id])
  return <>{children}{request && <AlertDialog key={request.id} open={closingId !== request.id} motionOrigin={request.origin} onOpenChange={(open) => {
    if (!open) setClosingId(request.id)
  }} onExitComplete={() => finishNovoConfirmation(request.id, accepted.current)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
        <AlertDialogDescription>{request.message}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => { accepted.current = false }}>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={() => { accepted.current = true }}>Continuar</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>}</>
}
