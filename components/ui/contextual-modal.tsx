"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { gsap } from "gsap"
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
  const closingRef = useRef(false)

  useLayoutEffect(() => {
    if (!open) return
    closingRef.current = false
    const panel = document.querySelector<HTMLElement>('[data-contextual-modal]')
    const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
    if (!panel) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const ctx = gsap.context(() => {
      gsap.fromTo(panel,
        { opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.96, filter: reduced ? "none" : "blur(8px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: reduced ? 0.14 : 0.28, ease: "power3.out" },
      )
      if (overlay) gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.12 : 0.2, ease: "power2.out" })
    })
    return () => ctx.revert()
  }, [open, anchorRect])

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    const panel = document.querySelector<HTMLElement>('[data-contextual-modal]')
    const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!panel) {
      onClose()
      return
    }
    const timeline = gsap.timeline({ onComplete: onClose })
    timeline.to(panel, { opacity: 0, y: reduced ? 0 : 6, scale: reduced ? 1 : 0.97, filter: reduced ? "none" : "blur(6px)", duration: reduced ? 0.12 : 0.18, ease: "power2.in" })
    if (overlay) timeline.to(overlay, { opacity: 0, duration: reduced ? 0.1 : 0.14 }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
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
