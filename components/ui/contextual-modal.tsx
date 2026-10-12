"use client"

import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ContextualModalProps {
  open: boolean
  anchorRect: DOMRect | null
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A local submodal: it materializes at the trigger's last position without
 * shared-element clones. The trigger is the spatial anchor, not an animated
 * asset, so status/progress details stay visually attached to their source.
 */
export function ContextualModal({ open, anchorRect, title, onClose, children }: ContextualModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        motionPreset="anchored"
        contextualRect={anchorRect}
        data-contextual-modal
        className="max-w-[min(28rem,calc(100%-1.5rem))] overflow-hidden rounded-[26px] border-foreground/[0.1] bg-background/95 p-0 backdrop-blur-2xl"
      >
        <div data-modal-content className="p-6 sm:p-7">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-xl font-medium tracking-[-0.03em]">{title}</DialogTitle>
          </DialogHeader>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
