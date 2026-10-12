'use client'

/**
 * useLiquidGlass — React hook for the Novo Liquid Glass renderer.
 *
 * Responsibilities:
 *  • Measures the container via ResizeObserver (never requires fixed dimensions)
 *  • Listens to window resize for adaptive updates
 *  • Caches generated filter URLs so identical params don't regenerate SVGs
 *  • Detects whether the current browser supports SVG filters in backdrop-filter
 *  • Leaves compositor hints to the active animation owner so static glass
 *    surfaces do not consume a permanent GPU layer
 */

import { useEffect, useRef, useState, useCallback, useMemo, useId } from 'react'
import {
  getDisplacementMap,
type DisplacementFilterParams,
} from './displacement-utils'
import {
  liquidGlassBudget,
  type RefractivePriority,
} from './liquid-glass-budget'

// ─── Filter Cache ─────────────────────────────────────────────────────────────

/** Module-level cache: cacheKey → DOM filter id */
const domFilterIds = new Map<string, string>()
/** Active GlassSurface instances pin their map so cache eviction can never
 * remove a filter URL still painted by the browser. */
const domFilterPins = new Map<string, number>()

const MAX_CACHE_SIZE = 64

function cacheKey(p: Required<DisplacementFilterParams>): string {
  return `${p.width}x${p.height}x${p.radius}x${p.depth}x${p.strength}x${p.chromaticAberration}`
}

function pinDOMFilter(key: string) {
  domFilterPins.set(key, (domFilterPins.get(key) ?? 0) + 1)
}

function unpinDOMFilter(key: string) {
  const remaining = (domFilterPins.get(key) ?? 1) - 1
  if (remaining > 0) domFilterPins.set(key, remaining)
  else domFilterPins.delete(key)
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
  const cachedId = domFilterIds.get(k)
  // A route transition or development refresh can remove the hidden SVG host
  // while this module cache remains alive. Never return a dead fragment URL:
  // it silently drops the refraction layer until another resize happens.
  if (cachedId && document.getElementById(cachedId)) return `url(#${cachedId})`
  if (cachedId) domFilterIds.delete(k)

  let svgContainer = document.getElementById('_ng_svg') as SVGSVGElement | null
  if (!svgContainer) {
    svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    svgContainer.id = '_ng_svg'
    svgContainer.setAttribute('aria-hidden', 'true')
    // Keep a non-zero SVG viewport. Chromium resolves filter resources from
    // zero-sized SVG roots inconsistently, which can silently turn a valid
    // `backdrop-filter: url(#...)` into a no-op. The host remains invisible
    // and non-interactive, but the resource tree has a paintable viewport.
    svgContainer.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;pointer-events:none;z-index:-9999;opacity:0'
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

  // Keep filters in a real <defs> registry. Chromium is permissive when a
  // filter is appended directly to the hidden SVG, but backdrop-filter URL
  // resolution is more reliable when the resource lives in the same
  // definition tree as the native SVG examples this renderer follows.
  let defs = svgContainer.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    defs.id = '_ng_defs'
    svgContainer.appendChild(defs)
  }

  const filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
  filterEl.id = id
  filterEl.setAttribute('color-interpolation-filters', 'sRGB')
  // Keep the filter region in the element's objectBoundingBox coordinate
  // system, as the reference component does. A pixel-sized userSpaceOnUse
  // region is technically valid but produces hard rectangular seams when a
  // displaced RGB channel reaches a rounded edge on a backdrop surface.
  // Percent padding gives every geometry the same optical breathing room.
  filterEl.setAttribute('x', '-12%')
  filterEl.setAttribute('y', '-12%')
  filterEl.setAttribute('width', '124%')
  filterEl.setAttribute('height', '124%')
  filterEl.setAttribute('primitiveUnits', 'userSpaceOnUse')

  // feImage loads the displacement map; three feDisplacementMap passes (one per
  // RGB channel at slightly different scales) recombine via screen blend to
  // produce chromatic aberration — exactly the srdavo/ekino pipeline.
  filterEl.innerHTML = [
    `<feImage x="0" y="0" width="${width}" height="${height}" href="${mapUrl}" xlink:href="${mapUrl}" result="dm" preserveAspectRatio="none"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scR}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="dR"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scG}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="dG"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="dm" scale="${scB}" xChannelSelector="R" yChannelSelector="G"/>`,
    `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="dB"/>`,
    `<feBlend in="dR" in2="dG" mode="screen" result="rg"/>`,
    `<feBlend in="rg" in2="dB" mode="screen"/>`,
  ].join('')
  defs.appendChild(filterEl)

  if (domFilterIds.size >= MAX_CACHE_SIZE) {
    // A cache entry can be older than the current layout and still be actively
    // painted by one of the five leased lenses. Only evict an unpinned filter;
    // otherwise allowing a short-lived cache overflow is cheaper than a
    // visible lens flashing flat until its next ResizeObserver update.
    const evictable = [...domFilterIds.keys()].find((key) => !domFilterPins.has(key))
    if (evictable) {
      const oldestId = domFilterIds.get(evictable)
      domFilterIds.delete(evictable)
      // Evict the stale DOM node too, otherwise the cache map shrinks but the
      // document keeps accumulating orphaned <filter> elements.
      if (oldestId) document.getElementById(oldestId)?.remove()
    }
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
  /** Enable the SVG displacement pipeline for this surface. */
  enabled?: boolean
  /** Retain a budget lease without constructing an unused React SVG filter. */
  leaseOnly?: boolean
  /** Controls which visible surfaces keep one of the five SVG leases. */
  priority?: RefractivePriority
  /** Releases the SVG lease without unmounting the CSS fallback. */
  active?: boolean
  /** Generate the raw displacement map only for explicit debug surfaces. */
  includeMap?: boolean
}

export interface UseLiquidGlassResult {
  /** Attach this to the glass container element */
  ref: React.RefObject<HTMLDivElement | null>
  /** A same-document SVG filter URL (or an empty string while measuring). */
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
  enabled = true,
  leaseOnly = false,
  priority = 'ambient',
  active = true,
  includeMap = false,
}: UseLiquidGlassOptions): UseLiquidGlassResult {
  const ref = useRef<HTMLDivElement>(null)
  const generatedLeaseId = useId()
  const leaseId = useRef(`novo-glass-${generatedLeaseId}`)
  const [dimensions, setDimensions] = useState({
    width: staticWidth || 0,
    height: staticHeight || 0,
  })
  const hasSVGFilterSupport = detectSVGFilterSupport()
  const [useSVGFilter, setUseSVGFilter] = useState(false)
  const [isIntersecting, setIsIntersecting] = useState(true)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  )

  useEffect(() => {
    if (!enabled) return
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry?.isIntersecting ?? true),
      { rootMargin: '96px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const update = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [enabled])

  // Sync static dimensions if they change when autoSize is disabled
  useEffect(() => {
    if (!autoSize && staticWidth !== undefined && staticHeight !== undefined) {
      setDimensions({ width: staticWidth, height: staticHeight })
    }
  }, [autoSize, staticWidth, staticHeight])

  // ResizeObserver: track element dimensions
  useEffect(() => {
    if (!enabled || !autoSize) return

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
  }, [enabled, autoSize])

  const { width, height } = dimensions

  // Evaluate eligibility based on browser support, element dimensions, and performance settings
  const isEligible = useMemo(() => {
    if (!enabled || !active || !isIntersecting || !pageVisible) return false
    if (!hasSVGFilterSupport) return false
    // A liquid lens needs enough *surface*, but does not need to be a square.
    // The old 120×120 gate excluded every intentional pill in Novo: the mobile
    // navigation rail is wide but only ~60px tall, and the expanded sidebar
    // route is a 40px-high strip. Those are the exact controls where the
    // product uses glass as a navigation cue. Keep circles/badges out while
    // allowing a sufficiently wide, shallow lens.
    const shortestSide = Math.min(width, height)
    const longestSide = Math.max(width, height)
    if (shortestSide < 36 || longestSide < 96 || width * height < 3456) return false

    // Respect showAnimations / performance settings via DOM attribute
    const reduceEffects = typeof document !== 'undefined' &&
      (document.documentElement.getAttribute('data-animations') === 'false' ||
       document.documentElement.classList.contains('low-perf'))
    if (reduceEffects) return false

    return true
  }, [enabled, active, isIntersecting, pageVisible, hasSVGFilterSupport, width, height])

  // Orchestrate active SVG filters to keep browser rasterization lightweight
  useEffect(() => {
    const id = leaseId.current
    const sync = () => setUseSVGFilter(isEligible && liquidGlassBudget.isGranted(id))
    const unsubscribe = liquidGlassBudget.subscribe(sync)
    if (isEligible) liquidGlassBudget.request(id, priority)
    else liquidGlassBudget.release(id)
    sync()

    return () => {
      unsubscribe()
      liquidGlassBudget.release(id)
    }
  }, [isEligible, priority])

  const filterUrl = useMemo(() => {
    if (width <= 0 || height <= 0 || !useSVGFilter || leaseOnly) return ''

    // Register the filter in the document's real SVG resource tree. Chromium
    // does not reliably resolve a data-URI fragment from backdrop-filter;
    // keeping the displacement map as a data image inside a same-document
    // <filter> is the path used by the delivered web component and is what
    // makes refraction visible in transformed portals as well.
    return getOrCreateDOMFilter({
      width,
      height,
      radius,
      depth,
      strength,
      chromaticAberration,
    })
  }, [width, height, radius, depth, strength, chromaticAberration, useSVGFilter, leaseOnly])

  const activeFilterKey = useMemo(
    () => width > 0 && height > 0 && useSVGFilter && !leaseOnly
      ? cacheKey({ width, height, radius, depth, strength, chromaticAberration })
      : null,
    [width, height, radius, depth, strength, chromaticAberration, useSVGFilter, leaseOnly],
  )

  useEffect(() => {
    if (!activeFilterKey) return
    pinDOMFilter(activeFilterKey)
    return () => unpinDOMFilter(activeFilterKey)
  }, [activeFilterKey])

  // Keep the raw map available for the debug surface too. The video variant
  // uses the same geometry texture before it wraps it in the RGB displacement
  // filter; exposing it here means debug mode never falls back to a blank
  // layer when a surface is still waiting for a filter lease.
  const mapUrl = useMemo(() => {
    if (!includeMap || width <= 0 || height <= 0) return ''
    const half = Math.floor(Math.min(width, height) / 2)
    const safeRadius = Math.min(radius, half)
    const safeDepth = Math.max(1, Math.min(depth, Math.max(1, half - 1)))
    return getDisplacementMap({ width, height, radius: safeRadius, depth: safeDepth })
  }, [includeMap, width, height, radius, depth])

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