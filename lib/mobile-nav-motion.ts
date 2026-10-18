export const NAV_MORPH_REST_EVENT = 'novo:nav-morph-rest'

export function restoreMobileNavigationFocus() {
  requestAnimationFrame(() => {
    if (document.activeElement !== document.body && document.activeElement?.isConnected) return
    const menu = document.querySelector<HTMLButtonElement>('nav button[aria-label="Open menu"]')
    if (menu?.getClientRects().length) menu.focus({ preventScroll: true })
  })
}

/** Physical completion owns presence; the timeout only rescues a lost renderer. */
export function waitForNavigationRest(surface: HTMLElement | null, onComplete: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let live = true
  const cancel = () => {
    live = false
    clearTimeout(timer)
    surface?.removeEventListener(NAV_MORPH_REST_EVENT, complete)
  }
  const complete = () => {
    if (!live) return
    cancel()
    onComplete()
  }
  surface?.addEventListener(NAV_MORPH_REST_EVENT, complete)
  timer = setTimeout(complete, 2400)
  if (surface?.dataset.liquidMorphSettled === 'closed') complete()
  return cancel
}
