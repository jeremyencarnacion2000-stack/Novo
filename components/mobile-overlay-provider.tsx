'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type MobileOverlayKind = 'none' | 'navigation' | 'voice' | 'utility'
type OpenMobileOverlayKind = Exclude<MobileOverlayKind, 'none'>

interface MobileOverlayContextValue {
  activeOverlay: MobileOverlayKind
  keyboardOpen: boolean
  openOverlay: (kind: OpenMobileOverlayKind) => void
  closeOverlay: () => void
  setKeyboardOpen: (open: boolean) => void
  suppressSecondary: boolean
}

const defaultValue: MobileOverlayContextValue = {
  activeOverlay: 'none',
  keyboardOpen: false,
  openOverlay: () => undefined,
  closeOverlay: () => undefined,
  setKeyboardOpen: () => undefined,
  suppressSecondary: false,
}

const MobileOverlayContext = createContext<MobileOverlayContextValue>(defaultValue)
const OVERLAY_HISTORY_KEY = '__novoMobileOverlay'

function isEditableControl(element: Element | null) {
  return element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLElement && element.isContentEditable
}

function hasOpenModalOrSheet() {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"], [data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]',
  )

  return Array.from(candidates).some((candidate) => !candidate.closest('[data-mobile-overlay]'))
}

export function MobileOverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeOverlay, setActiveOverlay] = useState<MobileOverlayKind>('none')
  const [keyboardOpen, setKeyboardOpenState] = useState(false)
  const [modalOrSheetOpen, setModalOrSheetOpen] = useState(false)
  const activeOverlayRef = useRef(activeOverlay)
  const ownsHistoryEntryRef = useRef(false)
  const closingHistoryEntryRef = useRef(false)

  useEffect(() => {
    activeOverlayRef.current = activeOverlay
  }, [activeOverlay])

  const openOverlay = useCallback((kind: OpenMobileOverlayKind) => {
    if (activeOverlayRef.current === 'none' && !ownsHistoryEntryRef.current) {
      window.history.pushState(
        { ...window.history.state, [OVERLAY_HISTORY_KEY]: kind },
        '',
        window.location.href,
      )
      ownsHistoryEntryRef.current = true
    } else if (ownsHistoryEntryRef.current) {
      window.history.replaceState(
        { ...window.history.state, [OVERLAY_HISTORY_KEY]: kind },
        '',
        window.location.href,
      )
    }

    activeOverlayRef.current = kind
    setActiveOverlay(kind)
  }, [])

  const closeOverlay = useCallback(() => {
    if (activeOverlayRef.current === 'none') return

    activeOverlayRef.current = 'none'
    setActiveOverlay('none')

    if (ownsHistoryEntryRef.current) {
      ownsHistoryEntryRef.current = false
      closingHistoryEntryRef.current = true
      window.history.back()
    }
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (closingHistoryEntryRef.current) {
        closingHistoryEntryRef.current = false
        return
      }
      if (activeOverlayRef.current === 'none') return

      event.stopImmediatePropagation()
      ownsHistoryEntryRef.current = false
      activeOverlayRef.current = 'none'
      setActiveOverlay('none')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardState = () => {
      const obscuredHeight = window.innerHeight - viewport.height
      setKeyboardOpenState(isEditableControl(document.activeElement) && obscuredHeight > 140)
    }
    const deferKeyboardUpdate = () => window.setTimeout(updateKeyboardState, 0)

    viewport.addEventListener('resize', updateKeyboardState)
    viewport.addEventListener('scroll', updateKeyboardState)
    window.addEventListener('focusin', deferKeyboardUpdate)
    window.addEventListener('focusout', deferKeyboardUpdate)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState)
      viewport.removeEventListener('scroll', updateKeyboardState)
      window.removeEventListener('focusin', deferKeyboardUpdate)
      window.removeEventListener('focusout', deferKeyboardUpdate)
    }
  }, [])

  useEffect(() => {
    const updateModalState = () => setModalOrSheetOpen(hasOpenModalOrSheet())
    updateModalState()

    const observer = new MutationObserver(updateModalState)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-modal', 'data-state'],
      childList: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [])

  const value = useMemo<MobileOverlayContextValue>(() => ({
    activeOverlay,
    keyboardOpen,
    openOverlay,
    closeOverlay,
    setKeyboardOpen: setKeyboardOpenState,
    suppressSecondary: activeOverlay !== 'none' || keyboardOpen || modalOrSheetOpen,
  }), [activeOverlay, closeOverlay, keyboardOpen, modalOrSheetOpen, openOverlay])

  return (
    <MobileOverlayContext.Provider value={value}>
      <div
        className="contents"
        data-testid="mobile-overlay-root"
        style={{
          '--mobile-safe-area-bottom': 'env(safe-area-inset-bottom)',
          '--mobile-navigation-bottom': 'calc(1rem + var(--mobile-safe-area-bottom))',
          '--mobile-utility-bottom': 'calc(5rem + var(--mobile-safe-area-bottom))',
        } as React.CSSProperties}
      >
        {children}
      </div>
    </MobileOverlayContext.Provider>
  )
}

export function useMobileOverlay() {
  return useContext(MobileOverlayContext)
}
