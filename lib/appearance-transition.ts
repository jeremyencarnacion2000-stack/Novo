import { shouldReduceNovoMotion } from '@/hooks/use-novo-motion-policy'
import { safeViewTransition } from '@/lib/view-transition'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

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
  if (typeof viewTransitionDocument.startViewTransition === 'function') {
    safeViewTransition(update)
    return
  }

  const root = document.documentElement
  root.setAttribute('data-appearance-transition', 'true')
  update()
  window.setTimeout(() => root.removeAttribute('data-appearance-transition'), 560)
}
