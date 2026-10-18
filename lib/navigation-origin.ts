let recentNavigation: { pathname: string; at: number } | null = null

export function hasRecentNavigation(pathname: string) {
  return recentNavigation?.pathname === pathname && Date.now() - recentNavigation.at < 6000
}

/** Route snapshots pivot toward the navigation control, without delaying it. */
export function rememberNavigationOrigin(element: Element, destination?: string) {
  if (destination) recentNavigation = { pathname: destination, at: Date.now() }
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = Math.max(0, Math.min(100, (rect.left + rect.width / 2) / window.innerWidth * 100))
  const y = Math.max(0, Math.min(100, (rect.top + rect.height / 2) / window.innerHeight * 100))
  document.documentElement.style.setProperty('--novo-route-origin', `${x.toFixed(2)}% ${y.toFixed(2)}%`)
}

export function trackNavigationOrigins() {
  const capture = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || link.download || (link.target && link.target !== '_self')) return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname || url.pathname.startsWith('/auth/')) return
    rememberNavigationOrigin(link, url.pathname)
  }
  // Capture preserves Link prefetch, modifier keys and Next's async commit.
  document.addEventListener('click', capture, true)
  return () => document.removeEventListener('click', capture, true)
}
