import type { NovoMotionMode } from '@/hooks/use-novo-motion-policy'

export type ModalMotionPreset =
  | 'shared'
  | 'center'
  | 'anchored'
  | 'command'
  | 'sheet'
  | 'fullscreen'
  | 'alert'

export type ModalMobilePresentation = 'inherit' | 'sheet' | 'fullscreen'

export const MODAL_CUSTOM_EASE = {
  fluid: 'M0,0 C0.10,0.64 0.14,0.91 0.32,0.985 C0.50,1 0.72,1 1,1',
} as const

/** Shared, visible-but-restrained overshoot for the Hub and nav surface morphs. */
export const SHARED_SURFACE_BOUNCE_STRENGTH = 0.14

/** Normalized critically-damped response shared by the Hub and nav morph. */
export function createSharedSurfaceSpring(omega: number) {
  const end = 1 - (1 + omega) * Math.exp(-omega)
  return (progress: number) => {
    const p = Math.max(0, Math.min(1, progress))
    return (1 - (1 + omega * p) * Math.exp(-omega * p)) / end
  }
}

export const SHARED_SURFACE_OPEN_EASE = createSharedSurfaceSpring(7.35)
export const SHARED_SURFACE_CLOSE_EASE = createSharedSurfaceSpring(8.15)

export function withSharedSurfaceBounce(
  baseEase: (progress: number) => number,
  strength = SHARED_SURFACE_BOUNCE_STRENGTH,
) {
  return (progress: number) => {
    const t = Math.max(0, Math.min(1, progress))
    const base = baseEase(t)
    if (t < 0.72 || t >= 1) return base

    const reboundPhase = (t - 0.72) / 0.28
    const rebound = Math.sin(Math.PI * reboundPhase) * Math.sin(2 * Math.PI * reboundPhase)
    return base + strength * rebound
  }
}

export function getSharedSurfaceMorphEase(direction: 'open' | 'close') {
  const baseEase = direction === 'open' ? SHARED_SURFACE_OPEN_EASE : SHARED_SURFACE_CLOSE_EASE
  return withSharedSurfaceBounce(baseEase)
}

export const MODAL_EASE = {
  enter: 'cubic-bezier(0.23, 1, 0.32, 1)',
  move: 'cubic-bezier(0.77, 0, 0.175, 1)',
  sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const

export const MODAL_MOTION = {
  shared: {
    enter: 0.59,
    exit: 0.52,
    subtitleAt: 0.34,
    contentAt: 0.38,
    closeAt: 0.43,
    subtitleDuration: 0.22,
    contentDuration: 0.28,
    closeDuration: 0.22,
    stagger: 0.034,
  },
  center: { enter: 0.3, exit: 0.22 },
  anchored: { enter: 0.24, exit: 0.18 },
  command: { enter: 0.18, exit: 0.14 },
  sheet: { enter: 0.38, exit: 0.28 },
  fullscreen: { enter: 0.38, exit: 0.28 },
  alert: { enter: 0.24, exit: 0.18 },
} as const satisfies Record<ModalMotionPreset, {
  enter: number
  exit: number
  subtitleAt?: number
  contentAt?: number
  closeAt?: number
  subtitleDuration?: number
  contentDuration?: number
  closeDuration?: number
  stagger?: number
}>

export function resolveModalMotionPreset({
  preset,
  legacyMotionId,
  flipAnchored = false,
  mobilePresentation = 'inherit',
  isMobile = false,
}: {
  preset?: ModalMotionPreset
  legacyMotionId?: string
  flipAnchored?: boolean
  mobilePresentation?: ModalMobilePresentation
  isMobile?: boolean
}): ModalMotionPreset {
  const resolved = preset ?? (legacyMotionId ? (flipAnchored ? 'anchored' : 'shared') : 'center')

  if (!isMobile || mobilePresentation === 'inherit') return resolved
  return mobilePresentation
}

export function resolveModalMotionStrategy(preset: ModalMotionPreset, mode: NovoMotionMode) {
  if (mode === 'off') {
    return { preset: 'center' as const, duration: 0, opacityOnly: true, immediate: true }
  }

  if (mode === 'reduced') {
    return { preset: 'center' as const, duration: 0.16, opacityOnly: true, immediate: false }
  }

  return {
    preset,
    duration: MODAL_MOTION[preset].enter,
    opacityOnly: false,
    immediate: false,
  }
}

export function isElementVisibleForSharedMotion(element: HTMLElement | null) {
  if (!element || !element.isConnected) return false
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
}

type RectLike = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>

function clipForRect(rect: RectLike, union: RectLike, radius: string) {
  return `inset(${rect.top - union.top}px ${union.right - rect.right}px ${union.bottom - rect.bottom}px ${rect.left - union.left}px round ${radius})`
}

function getBridgeMaterialSource(source: HTMLElement) {
  // GlassSurface keeps the optical layers inside the host so its content can
  // stay sharp. When a shared transition starts from that host, copying only
  // the host's background produces the old flat/fade result. Prefer the live
  // refractive layer, then the configured backdrop layer, and finally fall
  // back to the source itself for ordinary glassmorphism surfaces.
  return source.querySelector<HTMLElement>('[data-glass-refractive]')
    ?? source.querySelector<HTMLElement>('[data-glass-backdrop]')
    ?? source
}

export function copyBridgeMaterial(skin: HTMLElement, source: HTMLElement) {
  const materialSource = getBridgeMaterialSource(source)
  const styles = getComputedStyle(materialSource)
  const inlineStyles = materialSource.style as CSSStyleDeclaration & {
    webkitBackdropFilter?: string
  }
  const readStyle = (property: keyof CSSStyleDeclaration) => {
    const computed = styles[property] as string | undefined
    const inline = inlineStyles[property] as string | undefined
    return computed && computed !== 'none' ? computed : (inline || computed || '')
  }
  Object.assign(skin.style, {
    position: 'absolute',
    inset: '0',
    background: readStyle('background'),
    backgroundColor: readStyle('backgroundColor'),
    backgroundImage: readStyle('backgroundImage'),
    backgroundSize: readStyle('backgroundSize'),
    backgroundPosition: readStyle('backgroundPosition'),
    backgroundBlendMode: readStyle('backgroundBlendMode'),
    borderColor: readStyle('borderColor'),
    borderStyle: readStyle('borderStyle'),
    borderWidth: readStyle('borderWidth'),
    boxShadow: readStyle('boxShadow'),
    backdropFilter: readStyle('backdropFilter'),
    // CSSStyleDeclaration's DOM typings omit the vendor-prefixed property,
    // but Chromium still reads it from the style object.
    WebkitBackdropFilter: inlineStyles.webkitBackdropFilter || readStyle('backdropFilter'),
    filter: readStyle('filter'),
    opacity: readStyle('opacity'),
    mixBlendMode: readStyle('mixBlendMode'),
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
  } as Record<string, string>)
}

/**
 * Creates a compositor-friendly material bridge spanning the source and final
 * modal rectangles. The bridge changes shape through clip-path rather than
 * stretching a glass surface with scaleX/scaleY, so rounded edges and noise do
 * not deform while the live Radix dialog remains in its final layout.
 */
export function createModalChromeBridge(origin: HTMLElement, target: HTMLElement, zIndex = 5002) {
  const originRect = origin.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const union = {
    left: Math.min(originRect.left, targetRect.left),
    top: Math.min(originRect.top, targetRect.top),
    right: Math.max(originRect.right, targetRect.right),
    bottom: Math.max(originRect.bottom, targetRect.bottom),
    width: 0,
    height: 0,
  }
  union.width = union.right - union.left
  union.height = union.bottom - union.top

  const root = document.createElement('div')
  const compactSkin = document.createElement('div')
  const expandedSkin = document.createElement('div')
  const originStyles = getComputedStyle(origin)
  const targetStyles = getComputedStyle(target)
  const originRadius = originStyles.borderRadius || `${originRect.height / 2}px`
  const targetRadius = targetStyles.borderRadius || '24px'
  const startClip = clipForRect(originRect, union, originRadius)
  const endClip = clipForRect(targetRect, union, targetRadius)

  root.dataset.modalMotionBridge = ''
  root.setAttribute('aria-hidden', 'true')
  Object.assign(root.style, {
    position: 'fixed',
    left: `${union.left}px`,
    top: `${union.top}px`,
    width: `${union.width}px`,
    height: `${union.height}px`,
    margin: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    transform: 'translateZ(0)',
    transition: 'none',
    clipPath: startClip,
    willChange: 'clip-path, opacity, filter',
    contain: 'paint',
    zIndex: String(zIndex),
  } satisfies Partial<CSSStyleDeclaration>)

  compactSkin.dataset.modalMotionSkin = 'compact'
  expandedSkin.dataset.modalMotionSkin = 'expanded'
  copyBridgeMaterial(compactSkin, origin)
  copyBridgeMaterial(expandedSkin, target)
  expandedSkin.style.opacity = '0'
  root.append(compactSkin, expandedSkin)
  document.body.appendChild(root)

  return {
    root,
    compactSkin,
    expandedSkin,
    startClip,
    endClip,
    unionRect: union,
  }
}
