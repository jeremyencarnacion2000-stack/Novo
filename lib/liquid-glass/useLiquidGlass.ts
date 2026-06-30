'use client'

/**
 * useLiquidGlass — React hook for the Novo Liquid Glass renderer.
 *
 * Responsibilities:
 *  • Measures the container via ResizeObserver (never requires fixed dimensions)
 *  • Listens to window resize for adaptive updates
 *  • Caches generated filter URLs so identical params don't regenerate SVGs
 *  • Detects whether the current browser supports SVG filters in backdrop-filter
 *  • Wires `will-change: transform, filter` for GPU acceleration
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  getDisplacementMap,
  type DisplacementFilterParams,
} from './displacement-utils'

// ─── Filter Cache ─────────────────────────────────────────────────────────────

/** Module-level cache: cacheKey → DOM filter id */
const domFilterIds = new Map<string, string>()

const MAX_CACHE_SIZE = 64

function cacheKey(p: Required<DisplacementFilterParams>): string {
  return `${p.width}x${p.height}x${p.radius}x${p.depth}x${p.strength}x${p.chromaticAberration}`
}

/**
 * Injects the displacement SVG <filter> as a real DOM element so that
 * `backdrop-filter: url(#id)` resolves correctly in Chromium.
 *
 * Two hard constraints, both learned the hard way:
 *   1. The <filter> MUST live in the document. Referencing a filter inside a
 *      `data:` URI fragment (`url("data:…#displace")`) is NOT reliable for
 *      backdrop-filter in current Chromium — only same-document filter ids work.
 *   2. The displacement map fed to <feImage> MUST be a data-URI image. Chromium's
 *      feImage CANNOT render a referenced in-document element (`href="#localId"`)
 *      — that path silently produces an empty map and therefore zero distortion.
 *      So we embed the map via getDisplacementMap() as a data URI here.
 */
function getOrCreateDOMFilter(params: Required<DisplacementFilterParams>): string {
  if (typeof document === 'undefined') return ''
  const k = cacheKey(params)
  if (domFilterIds.has(k)) return `url(#${domFilterIds.get(k)})`

  let svgContainer = document.getElementById('_ng_svg') as SVGSVGElement | null
  if (!svgContainer) {
    svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    svgContainer.id = '_ng_svg'
    svgContainer.setAttribute('aria-hidden', 'true')
    svgContainer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:-9999'
    document.body.appendChild(svgContainer)
  }

  const id = `ngf${k.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 64)

  const { width, height, radius, depth, strength, chromaticAberration } = params
  const scR = strength + chromaticAberration * 2
  const scG = strength + chromaticAberration
  const scB = strength

  // A pill/circle is passed radius:9999. Left uncapped, the gradient stops in
  // the displacement map land far off-canvas and the edge lensing collapses, so
  // clamp the radius (and depth) to the geometry the element can actually hold.
  const half = Math.floor(Math.min(width, height) / 2)
  const safeRadius = Math.min(radius, half)
  const safeDepth = Math.max(1, Math.min(depth, half - 1))

  // Displacement texture as a data-URI image — the only feImage source Chromium
  // honours inside a backdrop-filter pipeline.
  const mapUrl = getDisplacementMap({ width, height, radius: safeRadius, depth: safeDepth })

  const filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
  filterEl.id = id
  filterEl.setAttribute('color-interpolation-filters', 'sRGB')
  filterEl.setAttribute('x', '0')
  filterEl.setAttribute('y', '0')
  filterEl.setAttribute('width', String(width))
  filterEl.setAttribute('height', String(height))
  filterEl.setAttribute('filterUnits', 'userSpaceOnUse')

  // feImage loads the displacement map; three feDisplacementMap passes (one per
  // RGB channel at slightly different scales) recombine via screen blend to
  // produce chromatic aberration — exactly the srdavo/ekino pipeline.
  filterEl.innerHTML = [
    `<feImage x="0" y="0" width="${width}" height="${height}" href="${mapUrl}" result="dm" preserveAspectRatio="none"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scR}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="dR"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scG}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="dG"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scB}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="dB"/>`,
    `<feBlend in="dR" in2="dG" mode="screen"/>`,
    `<feBlend in2="dB" mode="screen"/>`,
  ].join('')
  svgContainer.appendChild(filterEl)

  if (domFilterIds.size >= MAX_CACHE_SIZE) {
    const oldestKey = domFilterIds.keys().next().value!
    const oldestId = domFilterIds.get(oldestKey)
    domFilterIds.delete(oldestKey)
    // Evict the stale DOM node too, otherwise the cache map shrinks but the
    // document keeps accumulating orphaned <filter> elements.
    if (oldestId) document.getElementById(oldestId)?.remove()
  }
  domFilterIds.set(k, id)
  return `url(#${id})`
}

// ─── Browser Support Detection ────────────────────────────────────────────────

let _svgFilterSupport: boolean | undefined

function detectSVGFilterSupport(): boolean {
  if (_svgFilterSupport !== undefined) return _svgFilterSupport

  if (typeof window === 'undefined') return false

  const testEl = document.createElement('div')
  testEl.style.backdropFilter = 'blur(1px)'
  if (!testEl.style.backdropFilter) {
    _svgFilterSupport = false
    return false
  }

  const ua = navigator.userAgent.toLowerCase()
  const isChrome = /chrome|chromium|crios|edg/.test(ua) && !/firefox|fxios/.test(ua)
  const isFirefox = /firefox|fxios/.test(ua)
  const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|edg/.test(ua)

  if (isChrome) {
    _svgFilterSupport = true
  } else if (isFirefox || isSafari) {
    _svgFilterSupport = false
  } else {
    try {
      testEl.style.backdropFilter = 'url(#test)'
      _svgFilterSupport = testEl.style.backdropFilter.includes('url')
    } catch {
      _svgFilterSupport = false
    }
  }

  return _svgFilterSupport
}

// ─── Reactive Liquid Glass Registry ───────────────────────────────────────────
const listeners = new Set<() => void>()
let activeSVGFiltersCount = 0
const MAX_SIMULTANEOUS_SVG_FILTERS = 5

function registerSVGFilter(): boolean {
  if (activeSVGFiltersCount < MAX_SIMULTANEOUS_SVG_FILTERS) {
    activeSVGFiltersCount++
    listeners.forEach(l => l())
    return true
  }
  return false
}

function unregisterSVGFilter() {
  activeSVGFiltersCount = Math.max(0, activeSVGFiltersCount - 1)
  listeners.forEach(l => l())
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseLiquidGlassOptions {
  radius: number
  depth: number
  blur: number
  strength: number
  chromaticAberration: number
  adaptive?: boolean
  width?: number
  height?: number
  autoSize?: boolean
}

export interface UseLiquidGlassResult {
  /** Attach this to the glass container element */
  ref: React.RefObject<HTMLDivElement | null>
  /** The full `data:image/svg+xml...#displace` filter URL */
  filterUrl: string
  /** The raw displacement map URL (for debug mode) */
  mapUrl: string
  /** Measured container width (px) */
  width: number
  /** Measured container height (px) */
  height: number
  /** Whether the browser supports SVG filters in backdrop-filter */
  hasSVGFilterSupport: boolean
  /** Whether this specific element is currently rendered with the high-fidelity SVG filter */
  useSVGFilter: boolean
  /**
   * Call this to generate the complete backdrop-filter string,
   * including blur passes, brightness, and saturate.
   */
  buildBackdropFilter: () => string
}

export function useLiquidGlass({
  radius,
  depth,
  blur,
  strength,
  chromaticAberration,
  width: staticWidth,
  height: staticHeight,
  autoSize = true,
}: UseLiquidGlassOptions): UseLiquidGlassResult {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({
    width: staticWidth || 0,
    height: staticHeight || 0,
  })
  const hasSVGFilterSupport = detectSVGFilterSupport()
  const [useSVGFilter, setUseSVGFilter] = useState(false)

  // Sync static dimensions if they change when autoSize is disabled
  useEffect(() => {
    if (!autoSize && staticWidth !== undefined && staticHeight !== undefined) {
      setDimensions({ width: staticWidth, height: staticHeight })
    }
  }, [autoSize, staticWidth, staticHeight])

  // ResizeObserver: track element dimensions
  useEffect(() => {
    if (!autoSize) return

    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      if (w > 0 && h > 0) {
        const roundedW = Math.ceil(w / 16) * 16
        const roundedH = Math.ceil(h / 16) * 16
        setDimensions(prev => (prev.width === roundedW && prev.height === roundedH ? prev : { width: roundedW, height: roundedH }))
      }
    })
    ro.observe(el)

    return () => ro.disconnect()
  }, [autoSize])

  const { width, height } = dimensions

  // Evaluate eligibility based on browser support, element dimensions, and performance settings
  const isEligible = useMemo(() => {
    if (!hasSVGFilterSupport) return false
    // Don't apply heavy SVG displacement filters to small components (like buttons, small badges, tabs)
    if (width < 120 || height < 120) return false

    // Respect showAnimations / performance settings via DOM attribute
    const reduceEffects = typeof document !== 'undefined' &&
      (document.documentElement.getAttribute('data-animations') === 'false' ||
       document.documentElement.classList.contains('low-perf'))
    if (reduceEffects) return false

    return true
  }, [hasSVGFilterSupport, width, height])

  // Orchestrate active SVG filters to keep browser rasterization lightweight
  useEffect(() => {
    let registered = false

    const checkRegistration = () => {
      if (!isEligible) {
        if (registered) {
          unregisterSVGFilter()
          registered = false
          setUseSVGFilter(false)
        }
        return
      }

      if (registered) return

      // Try to register as an active SVG filter
      const success = registerSVGFilter()
      if (success) {
        registered = true
        setUseSVGFilter(true)
      } else {
        setUseSVGFilter(false)
      }
    }

    checkRegistration()
    listeners.add(checkRegistration)

    return () => {
      listeners.delete(checkRegistration)
      if (registered) {
        unregisterSVGFilter()
      }
    }
  }, [isEligible])

  const filterUrl = useMemo(() =>
    width > 0 && height > 0 && useSVGFilter
      ? getOrCreateDOMFilter({ width, height, radius, depth, strength, chromaticAberration })
      : '',
    [width, height, radius, depth, strength, chromaticAberration, useSVGFilter]
  )

  const mapUrl = ''

  const buildBackdropFilter = useCallback((): string => {
    if (hasSVGFilterSupport && useSVGFilter && filterUrl) {
      return `blur(${blur / 2}px) ${filterUrl} blur(${blur}px) brightness(1.1) saturate(1.5)`
    }
    // High-quality frosted glass blur fallback when SVG filter is not used
    const fallbackBlur = Math.max(20, blur * 10)
    return `blur(${fallbackBlur}px) saturate(150%) brightness(1.05)`
  }, [blur, hasSVGFilterSupport, useSVGFilter, filterUrl])

  return {
    ref,
    filterUrl,
    mapUrl,
    width,
    height,
    hasSVGFilterSupport,
    useSVGFilter,
    buildBackdropFilter,
  }
}
