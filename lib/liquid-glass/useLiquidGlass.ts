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
  getDisplacementMap,
  type DisplacementFilterParams,
} from './displacement-utils'

// ─── Filter Cache ─────────────────────────────────────────────────────────────

/** Module-level cache: cacheKey → DOM filter id */
const domFilterIds = new Map<string, string>()
const mapCache = new Map<string, string>()

const MAX_CACHE_SIZE = 64

function cacheKey(p: Required<DisplacementFilterParams>): string {
  return `${p.width}x${p.height}x${p.radius}x${p.depth}x${p.strength}x${p.chromaticAberration}`
}

function mapKey(w: number, h: number, r: number, d: number): string {
  return `${w}x${h}x${r}x${d}`
}

/**
 * Injects the displacement SVG filter as a real DOM element so that
 * `backdrop-filter: url('#id')` resolves correctly in Chrome.
 * Data-URI fragment references (#displace) are NOT reliable for backdrop-filter.
 */
function getOrCreateDOMFilter(params: Required<DisplacementFilterParams>): string {
  if (typeof document === 'undefined') return ''
  const k = cacheKey(params)
  if (domFilterIds.has(k)) return `url('#${domFilterIds.get(k)}')`

  let svgContainer = document.getElementById('_ng_svg') as SVGSVGElement | null
  if (!svgContainer) {
    svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement
    svgContainer.id = '_ng_svg'
    svgContainer.setAttribute('aria-hidden', 'true')
    svgContainer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:-9999'
    document.body.appendChild(svgContainer)
  }

  let defsEl = svgContainer.querySelector('defs')
  if (!defsEl) {
    defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svgContainer.appendChild(defsEl)
  }

  const id = `ngf${k.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 64)
  const mapId = `map_${id}`
  const gradY = `Y_${id}`
  const gradX = `X_${id}`

  const { width, height, radius, depth, strength, chromaticAberration } = params
  const scR = strength + chromaticAberration * 2
  const scG = strength + chromaticAberration
  const scB = strength

  // Inject displacement gradients and map directly into defs
  const mapGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  mapGroup.id = mapId
  mapGroup.innerHTML = `
    <linearGradient id="${gradY}" x1="0" x2="0" y1="${Math.ceil((radius / height) * 15)}%" y2="${Math.floor(100 - (radius / height) * 15)}%">
      <stop offset="0%" stop-color="#0F0" />
      <stop offset="100%" stop-color="#000" />
    </linearGradient>
    <linearGradient id="${gradX}" x1="${Math.ceil((radius / width) * 15)}%" x2="${Math.floor(100 - (radius / width) * 15)}%" y1="0" y2="0">
      <stop offset="0%" stop-color="#F00" />
      <stop offset="100%" stop-color="#000" />
    </linearGradient>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#000080" />
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${gradY})" style="mix-blend-mode: screen;" />
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${gradX})" style="mix-blend-mode: screen;" />
      <rect x="${depth}" y="${depth}" width="${width - 2 * depth}" height="${height - 2 * depth}" fill="#808080" rx="${radius}" ry="${radius}" filter="blur(${depth}px)" />
    </g>
  `
  defsEl.appendChild(mapGroup)

  const filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
  filterEl.id = id
  filterEl.setAttribute('color-interpolation-filters', 'sRGB')
  filterEl.setAttribute('x', '0')
  filterEl.setAttribute('y', '0')
  filterEl.setAttribute('width', String(width))
  filterEl.setAttribute('height', String(height))
  filterEl.setAttribute('filterUnits', 'userSpaceOnUse')

  // Reference the mapGroup element inside defs by #id
  filterEl.innerHTML = [
    `<feImage href="#${mapId}" result="dm" preserveAspectRatio="none"/>`,
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
    domFilterIds.delete(domFilterIds.keys().next().value!)
  }
  domFilterIds.set(k, id)
  return `url('#${id}')`
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

    // Enable GPU acceleration immediately
    el.style.willChange = 'transform, filter, backdrop-filter, opacity'

    function measure() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const w = Math.ceil(rect.width)
      const h = Math.ceil(rect.height)
      if (w > 0 && h > 0) {
        // Round to nearest 16px to prevent layout thrashing and maximize filter cache hit rate
        const roundedW = Math.ceil(w / 16) * 16
        const roundedH = Math.ceil(h / 16) * 16
        setDimensions(prev => (prev.width === roundedW && prev.height === roundedH ? prev : { width: roundedW, height: roundedH }))
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
  }, [autoSize])

  const { width, height } = dimensions

  // DOM-injected filter ref: url('#id') — reliable in Chrome
  const filterUrl = width > 0 && height > 0
    ? getOrCreateDOMFilter({ width, height, radius, depth, strength, chromaticAberration })
    : ''

  const mapUrl = ''

  const buildBackdropFilter = useCallback((): string => {
    return `blur(${blur}px) brightness(1.08) saturate(1.4)`
  }, [blur])

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
