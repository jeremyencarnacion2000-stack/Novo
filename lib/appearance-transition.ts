import { shouldReduceNovoMotion } from '@/hooks/use-novo-motion-policy'
import { safeViewTransition } from '@/lib/view-transition'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

let markerTimer: ReturnType<typeof setTimeout> | undefined
let appearanceRevision = 0

/**
 * Keeps a visual preference update (theme, wallpaper, accent) as one atomic
 * handoff. Chromium can crossfade the full rendered frame; other browsers get
 * a short CSS transition marker. Motion-sensitive users always get an instant
 * update.
 */
export function runAppearanceTransition(update: () => void) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    update()
    return
  }

  if (shouldReduceNovoMotion()) {
    update()
    return
  }

  const viewTransitionDocument = document as ViewTransitionDocument
  const root = document.documentElement
  const revision = ++appearanceRevision
  clearTimeout(markerTimer)
  root.setAttribute('data-appearance-transition', 'true')
  const clearMarker = () => {
    if (revision !== appearanceRevision) return
    clearTimeout(markerTimer)
    root.removeAttribute('data-appearance-transition')
  }
  if (typeof viewTransitionDocument.startViewTransition === 'function') {
    const transition = safeViewTransition(update)
    markerTimer = setTimeout(clearMarker, 1200)
    transition?.finished?.then(clearMarker, clearMarker)
    return
  }

  update()
  markerTimer = setTimeout(clearMarker, 560)
}
