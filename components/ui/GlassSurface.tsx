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
 *   <GlassSurface radius={28} depth={16} blur={20} strength={90} chromaticAberration={1.5} adaptive>
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
   * Pre/post blur in pixels applied to the backdrop-filter chain.
   * @default 20
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
   * Glass background color. Supports any CSS color.
   * @default 'rgba(var(--md-sys-color-neutral-background), 0.1)'
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
      depth = 10,
      blur = 20,
      strength = 100,
      chromaticAberration = 15,
      adaptive = true,
      debug = false,
      backgroundColor = 'rgba(var(--md-sys-color-neutral-background), 0.1)',
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
        overflow: 'hidden',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }
    }, [radius])

    const bgStyles = React.useMemo<React.CSSProperties>(() => {
      let activeBg = backgroundColor
      let activeBorder = '1px solid rgba(255, 255, 255, 0.08)'
      let activeShadow = elevationShadow[elevation]

      if (contrastObserver && resolvedContrast) {
        if (resolvedContrast === 'dark') {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(20, 20, 23, 0.15)'
            : backgroundColor
          activeBorder = '1px solid rgba(255, 255, 255, 0.08)'
          activeShadow = '0 24px 80px rgba(0,0,0,0.50), inset 1px 1px 0 rgba(255,255,255,0.15)'
        } else {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(255, 255, 255, 0.25)'
            : backgroundColor
          activeBorder = '1px solid rgba(0, 0, 0, 0.08)'
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

      if (!hasSVGFilterSupport || !filterUrl) {
        return {
          ...baseBg,
          backdropFilter: `blur(${blur * 1.5}px) brightness(1.08) saturate(1.4)`,
          WebkitBackdropFilter: `blur(${blur * 1.5}px) brightness(1.08) saturate(1.4)`,
        }
      }

      const bdFilter = `blur(${Math.max(1, blur * 0.4)}px) ${filterUrl} blur(${Math.max(0.5, blur * 0.3)}px) brightness(1.08) saturate(1.4)`
      return {
        ...baseBg,
        backdropFilter: bdFilter,
        WebkitBackdropFilter: bdFilter,
      }
    }, [
      backgroundColor,
      elevation,
      contrastObserver,
      resolvedContrast,
      debug,
      mapUrl,
      hasSVGFilterSupport,
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

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'contents' }}>
          {children}
        </div>
      </Component>
    )
  },
)

GlassSurface.displayName = 'GlassSurface'

export { GlassSurface }
export default GlassSurface
