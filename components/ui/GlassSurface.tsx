'use client'

/**
 * GlassSurface — Novo's official Liquid Glass renderer.
 *
 * Architecture:
 *  • Internally calls window.DisplacementUtils.getDisplacementFilter(...)
 *    via the useLiquidGlass hook.
 *  • SVG pipeline: feImage → feDisplacementMap × 3 → feColorMatrix × 3 → feBlend × 2
 *  • ResizeObserver auto-updates the filter whenever dimensions change.
 *  • Filter results are cached; identical params never regenerate.
 *  • Only transform, opacity, filter, backdrop-filter are animated — never layout.
 *  • GPU acceleration via will-change on mount.
 *  • Graceful fallback for browsers without SVG-filter backdrop-filter support.
 *
 * Usage:
 *   <GlassSurface radius={28} depth={16} blur={2} strength={90} chromaticAberration={1.5} adaptive>
 *     <p>Content</p>
 *   </GlassSurface>
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useLiquidGlass } from '@/lib/liquid-glass/useLiquidGlass'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GlassSurfaceProps extends React.ComponentPropsWithoutRef<'div'> {
  /**
   * Border radius in pixels — fed into the displacement map to match geometry.
   * @default 128
   */
  radius?: number

  /**
   * Material depth: controls how far the blurred inner rect is inset.
   * Larger values = more pronounced lensing at the edges.
   * @default 10
   */
  depth?: number

  /**
   * Pre/post blur in pixels applied to the backdrop-filter chain. Keep this
   * LOW (≈0–3) — blur is the expensive filter and high values frost over the
   * displacement, killing the transparent/refractive "liquid glass" look.
   * @default 2
   */
  blur?: number

  /**
   * Base displacement scale for feDisplacementMap.
   * @default 100
   */
  strength?: number

  /**
   * Chromatic aberration spread. 0 = disabled.
   * @default 15
   */
  chromaticAberration?: number

  /**
   * When true, material adapts when window resizes (re-measures and regenerates filter).
   * @default true
   */
  adaptive?: boolean

  /**
   * Render the raw displacement map as the background for debugging.
   * @default false
   */
  debug?: boolean

  /**
   * Glass background color. Supports any CSS color. Keep the alpha very low
   * (≈0.03–0.08) for the transparent crystal look.
   * @default 'rgba(var(--md-sys-color-neutral-background), 0.05)'
   */
  backgroundColor?: string

  /**
   * Elevation tier — affects shadow intensity.
   * @default 'medium'
   */
  elevation?: 'low' | 'medium' | 'high'

  /**
   * Custom element tag to render as (e.g. 'button', 'a', Link, etc.)
   * @default 'div'
   */
  as?: React.ElementType

  /**
   * Dynamically tracks parent background luminance and adjusts text/borders contrast.
   * @default false
   */
  contrastObserver?: boolean

  /**
   * Enables ResizeObserver to dynamically update filter maps to fit the element dimensions.
   * @default true
   */
  autoSize?: boolean

  /** Static/fixed width overrides */
  width?: number
  /** Static/fixed height overrides */
  height?: number
  /** Allow dynamic attributes for polymorphic rendering (e.g. href, type, disabled) */
  [x: string]: any
}

// ─── Shadow / Highlight Tokens ────────────────────────────────────────────────

const elevationShadow: Record<NonNullable<GlassSurfaceProps['elevation']>, string> = {
  low:    '0 4px 24px rgba(0,0,0,0.18), inset 1px 1px 0 rgba(255,255,255,0.30), inset -1px -1px 0 rgba(255,255,255,0.10)',
  medium: '0 24px 80px rgba(0,0,0,0.35), inset 1px 1px 0 rgba(255,255,255,0.40), inset -1px -1px 0 rgba(255,255,255,0.12)',
  high:   '0 40px 120px rgba(0,0,0,0.50), inset 1px 1px 0 rgba(255,255,255,0.55), inset -1px -1px 0 rgba(255,255,255,0.18)',
}

// ─── Component ────────────────────────────────────────────────────────────────

const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    {
      radius = 128,
      depth = 6,
      blur = 1,
      strength = 40,
      chromaticAberration = 6,
      adaptive = true,
      debug = false,
      backgroundColor = 'rgba(var(--md-sys-color-neutral-background), 0.05)',
      elevation = 'medium',
      as,
      contrastObserver = false,
      autoSize = true,
      width: staticWidth,
      height: staticHeight,
      className,
      style,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const {
      ref: internalRef,
      filterUrl,
      mapUrl,
      hasSVGFilterSupport,
      useSVGFilter,
      buildBackdropFilter,
    } = useLiquidGlass({
      radius,
      depth,
      blur,
      strength,
      chromaticAberration,
      adaptive,
      width: staticWidth,
      height: staticHeight,
      autoSize,
    })

    const [resolvedContrast, setResolvedContrast] = React.useState<'light' | 'dark' | null>(null)

    // Merge forwarded ref with internal ResizeObserver ref
    const ref = React.useCallback(
      (node: any) => {
        ;(internalRef as React.MutableRefObject<any>).current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<any>).current = node
        }
      },
      [internalRef, forwardedRef],
    )

    // ── Contrast Observer logic ──────────────────────────────────────────────

    React.useEffect(() => {
      if (!contrastObserver) return

      const el = internalRef.current
      if (!el) return

      const getBackgroundLuminance = (element: HTMLElement): 'light' | 'dark' => {
        let current: HTMLElement | null = element
        while (current) {
          const computed = window.getComputedStyle(current)
          const bg = computed.backgroundColor
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            const match = bg.match(/\d+/g)
            if (match && match.length >= 3) {
              const r = parseInt(match[0], 10)
              const g = parseInt(match[1], 10)
              const b = parseInt(match[2], 10)
              const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
              return luminance < 140 ? 'dark' : 'light'
            }
          }
          current = current.parentElement
        }
        // Fallback to checking document root theme
        if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
          return 'dark'
        }
        return 'light'
      }

      const updateContrast = () => {
        const lum = getBackgroundLuminance(el)
        setResolvedContrast(lum)
      }

      updateContrast()

      const themeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
            updateContrast()
          }
        }
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      })

      let parentObserver: MutationObserver | null = null
      if (el.parentElement) {
        parentObserver = new MutationObserver(updateContrast)
        parentObserver.observe(el.parentElement, {
          attributes: true,
          attributeFilter: ['class', 'style'],
        })
      }

      window.addEventListener('resize', updateContrast, { passive: true })

      return () => {
        themeObserver.disconnect()
        if (parentObserver) parentObserver.disconnect()
        window.removeEventListener('resize', updateContrast)
      }
    }, [contrastObserver, internalRef])

    // ── Build inline styles ──────────────────────────────────────────────────

    const computedStyle = React.useMemo<React.CSSProperties>(() => {
      return {
        borderRadius: radius,
        position: 'relative',
        isolation: 'isolate',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }
    }, [radius])

    const bgStyles = React.useMemo<React.CSSProperties>(() => {
      let activeBg = backgroundColor
      let activeBorder = '1px solid rgba(255, 255, 255, 0.08)'
      let activeShadow = elevationShadow[elevation as 'low' | 'medium' | 'high']

      if (contrastObserver && resolvedContrast) {
        // Keep the tint near-transparent so the displacement/refraction stays
        // visible (crystal-clear look). Just enough tint to anchor the panel.
        if (resolvedContrast === 'dark') {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(20, 20, 23, 0.06)'
            : backgroundColor
          activeBorder = '1px solid rgba(255, 255, 255, 0.10)'
          activeShadow = '0 24px 80px rgba(0,0,0,0.45), inset 1px 1px 0 rgba(255,255,255,0.18)'
        } else {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(255, 255, 255, 0.10)'
            : backgroundColor
          activeBorder = '1px solid rgba(255, 255, 255, 0.30)'
          activeShadow = '0 12px 40px rgba(0,0,0,0.08), inset 1px 1px 0 rgba(255,255,255,0.6)'
        }
      }

      const baseBg: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none',
        zIndex: 0,
        background: activeBg,
        border: activeBorder,
        boxShadow: activeShadow,
        transition: 'backdrop-filter 200ms ease, filter 200ms ease, opacity 200ms ease',
      }

      if (debug && mapUrl) {
        return {
          ...baseBg,
          backgroundImage: `url("${mapUrl}")`,
          backgroundSize: '100% 100%',
          boxShadow: 'none',
        }
      }

      // Exact srdavo/ekino backdrop-filter chain. The displacement filter must
      // sit *inside* backdrop-filter (not the `filter` property) so it bends the
      // content behind the panel. A half pre-blur softens the backdrop so the
      // lens samples smooth pixels, then the SVG filter displaces + chromatically
      // splits it, then the full blur + tone pass finishes the material.
      const displace = hasSVGFilterSupport && useSVGFilter && filterUrl ? `${filterUrl} ` : ''
      const bd = displace 
        ? `blur(${blur / 2}px) ${displace}blur(${blur}px) brightness(1.1) saturate(1.5)`
        : `blur(${Math.max(20, blur * 10)}px) saturate(150%) brightness(1.05)`
      return {
        ...baseBg,
        backdropFilter: bd,
        WebkitBackdropFilter: bd,
      }
    }, [
      backgroundColor,
      elevation,
      contrastObserver,
      resolvedContrast,
      debug,
      mapUrl,
      hasSVGFilterSupport,
      useSVGFilter,
      filterUrl,
      blur,
    ])

    const Component = as || 'div'

    return (
      <Component
        ref={ref}
        data-novo-glass
        data-elevation={elevation}
        data-contrast={resolvedContrast}
        className={cn(
          'flex flex-col',
          className,
        )}
        style={{ ...computedStyle, ...style }}
        {...rest}
      >
        {/* Liquid Glass Background Layer */}
        <div aria-hidden style={bgStyles} />

        {/* Inner edge highlight */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
            zIndex: 1,
          }}
        />

        {/* Content — z-2 lifts above bg (z-0) and highlight (z-1) layers */}
        <div className="relative z-[2] flex flex-col flex-1 min-h-0 min-w-0">
          {children}
        </div>
      </Component>
    )
  },
)

GlassSurface.displayName = 'GlassSurface'

export { GlassSurface }
export default GlassSurface
