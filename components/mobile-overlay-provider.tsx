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
  /**
   * `historyAction` is accepted for call-site compatibility but ignored:
   * overlays no longer own synthetic history entries (see popstate handler).
   */
  closeOverlay: (options?: { historyAction?: 'back' | 'replace' | 'none' }) => void
  setKeyboardOpen: (open: boolean) => void
  setModalOpen: (open: boolean) => void
  suppressSecondary: boolean
}

const defaultValue: MobileOverlayContextValue = {
  activeOverlay: 'none',
  keyboardOpen: false,
  openOverlay: () => undefined,
  closeOverlay: () => undefined,
  setKeyboardOpen: () => undefined,
  setModalOpen: () => undefined,
  suppressSecondary: false,
}

const MobileOverlayContext = createContext<MobileOverlayContextValue>(defaultValue)

function isEditableControl(element: Element | null) {
  return element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLElement && element.isContentEditable
}

export function MobileOverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeOverlay, setActiveOverlay] = useState<MobileOverlayKind>('none')
  const [keyboardOpen, setKeyboardOpenState] = useState(false)
  const [modalOrSheetOpen, setModalOrSheetOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 767,
  )
  const activeOverlayRef = useRef(activeOverlay)
  const consumingForwardRef = useRef(false)

  useEffect(() => {
    activeOverlayRef.current = activeOverlay
  }, [activeOverlay])

  // Overlays are pure state. They used to push a synthetic history entry so
  // the system Back gesture would close them, but that entry kept racing
  // with Next.js' own pushState during in-drawer navigation and bounced
  // users to the previous route. Back is now consumed in the popstate
  // handler below without ever mutating history from this provider.
  const openOverlay = useCallback((kind: OpenMobileOverlayKind) => {
    activeOverlayRef.current = kind
    setActiveOverlay(kind)
  }, [])

  const closeOverlay = useCallback((_options?: { historyAction?: 'back' | 'replace' | 'none' }) => {
    if (activeOverlayRef.current === 'none') return

    activeOverlayRef.current = 'none'
    setActiveOverlay('none')
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // The follow-up popstate fired by our own history.forward() below.
      if (consumingForwardRef.current) {
        consumingForwardRef.current = false
        event.stopImmediatePropagation()
        return
      }
      if (activeOverlayRef.current === 'none') return

      // The browser already stepped back. Close the sheet, then step forward
      // again to reclaim that same entry — the Back gesture closes the
      // overlay while the page stays put, with zero synthetic entries.
      event.stopImmediatePropagation()
      activeOverlayRef.current = 'none'
      setActiveOverlay('none')
      consumingForwardRef.current = true
      window.history.forward()
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
    const media = window.matchMedia?.('(max-width: 767px)')
    const update = () => setIsMobileViewport(window.innerWidth <= 767)
    update()
    media?.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    return () => {
      media?.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const value = useMemo<MobileOverlayContextValue>(() => ({
    activeOverlay,
    keyboardOpen,
    openOverlay,
    closeOverlay,
    setKeyboardOpen: setKeyboardOpenState,
    setModalOpen: setModalOrSheetOpen,
    suppressSecondary: isMobileViewport && (activeOverlay !== 'none' || keyboardOpen || modalOrSheetOpen),
  }), [activeOverlay, closeOverlay, isMobileViewport, keyboardOpen, modalOrSheetOpen, openOverlay])

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
