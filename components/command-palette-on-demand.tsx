'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const CommandPalette = dynamic(
  () => import('@/components/command-palette').then(module => ({ default: module.CommandPalette })),
  { ssr: false },
)

export function CommandPaletteOnDemand() {
  const [requested, setRequested] = useState(false)
  useEffect(() => {
    if (requested) return
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setRequested(true)
      }
    }
    const open = () => setRequested(true)
    document.addEventListener('keydown', shortcut)
    window.addEventListener('open-command-palette', open)
    return () => {
      document.removeEventListener('keydown', shortcut)
      window.removeEventListener('open-command-palette', open)
    }
  }, [requested])
  return requested ? <CommandPalette initialOpen /> : null
}
