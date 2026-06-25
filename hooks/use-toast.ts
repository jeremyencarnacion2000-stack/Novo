'use client'

import { sileo } from 'sileo'
import type { SileoState } from 'sileo'

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

const variantMap: Record<ToastVariant, SileoState> = {
  default: 'success',
  destructive: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
}

function toast({ title, description, variant = 'default', duration }: ToastOptions) {
  const type = variantMap[variant] || 'success'

  const isError = variant === 'destructive'
  const isWarning = variant === 'warning'

  const id = sileo.show({
    title: title || '',
    description: description || undefined,
    type,
    duration: duration ?? (isError ? 6000 : isWarning ? 5000 : 4000),
  })

  return {
    id,
    dismiss: () => sileo.dismiss(id),
    update: () => {},
  }
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string) => {
      if (id) sileo.dismiss(id)
      else sileo.clear()
    },
    toasts: [],
  }
}

export { useToast, toast }
