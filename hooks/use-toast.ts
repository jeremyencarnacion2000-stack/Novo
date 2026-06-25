'use client'

import { sileo } from 'sileo'

type ToastVariant = 'default' | 'destructive'

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

function toast({ title, description, variant, duration }: ToastOptions) {
  const type = variant === 'destructive' ? 'error' : 'success'

  const id = sileo.show({
    title: title || '',
    description: description || '',
    type,
    duration: duration ?? 4000,
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
