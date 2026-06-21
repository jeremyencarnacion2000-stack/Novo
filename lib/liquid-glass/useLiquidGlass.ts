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

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getDisplacementFilter,
  getDisplacementMap,
  type DisplacementFilterParams,
} from './displacement-utils'

// ─── Filter Cache ─────────────────────────────────────────────────────────────

/** Module-level LRU-style cache keyed by all relevant params. */
const filterCache = new Map<string, string>()
const mapCache = new Map<string, string>()

const MAX_CACHE_SIZE = 64

function cacheKey(p: Required<DisplacementFilterParams>): string {
  return `${p.width}x${p.height}x${p.radius}x${p.depth}x${p.strength}x${p.chromaticAberration}`
}

function mapKey(w: number, h: number, r: number, d: number): string {
  return `${w}x${h}x${r}x${d}`
}

function getCachedFilter(params: Required<DisplacementFilterParams>): string {
  const k = cacheKey(params)
  if (filterCache.has(k)) return filterCache.get(k)!
  const url = getDisplacementFilter(params)
  if (filterCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    filterCache.delete(filterCache.keys().next().value!)
  }
  filterCache.set(k, url)
  return url
}

function getCachedMap(w: number, h: number, r: number, d: number): string {
  const k = mapKey(w, h, r, d)
  if (mapCache.has(k)) return mapCache.get(k)!
  const url = getDisplacementMap({ width: w, height: h, radius: r, depth: d })
  if (mapCache.size >= MAX_CACHE_SIZE) {
    mapCache.delete(mapCache.keys().next().value!)
  }
  mapCache.set(k, url)
  return url
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
}: UseLiquidGlassOptions): UseLiquidGlassResult {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const hasSVGFilterSupport = detectSVGFilterSupport()

  // ResizeObserver: track element dimensions
  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Enable GPU acceleration immediately
    el.style.willChange = 'transform, filter, backdrop-filter, opacity'

    function measure() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const w = Math.ceil(rect.width)
      const h = Math.ceil(rect.height)
      if (w > 0 && h > 0) {
        setDimensions(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
      }
    }

    // Initial measure
    requestAnimationFrame(() => requestAnimationFrame(measure))

    const ro = new ResizeObserver(measure)
    ro.observe(el)

    // Window resize — adaptive material
    const onResize = () => measure()
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const { width, height } = dimensions

  // Compute cached filter/map URLs
  const filterUrl = width > 0 && height > 0
    ? getCachedFilter({
        width,
        height,
        radius,
        depth,
        strength,
        chromaticAberration,
      })
    : ''

  const mapUrl = width > 0 && height > 0
    ? getCachedMap(width, height, radius, depth)
    : ''

  const buildBackdropFilter = useCallback((): string => {
    if (!hasSVGFilterSupport || !filterUrl) {
      return `blur(${blur * 2}px)`
    }
    return [
      `blur(${blur / 2}px)`,
      `url('${filterUrl}')`,
      `blur(${blur}px)`,
      'brightness(1.1)',
      'saturate(1.5)',
    ].join(' ')
  }, [hasSVGFilterSupport, filterUrl, blur])

  return {
    ref,
    filterUrl,
    mapUrl,
    width,
    height,
    hasSVGFilterSupport,
    buildBackdropFilter,
  }
}
