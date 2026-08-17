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

  /** The product material this surface represents. @default 'context' */
  material?: 'context' | 'focus'

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

type GlassBackdropStyle = React.CSSProperties & {
  '--novo-glass-background': string
  '--novo-glass-backdrop-filter'?: string
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
      backgroundColor,
      material = 'context',
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
      mapUrl,
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

    const bgStyles = React.useMemo<GlassBackdropStyle>(() => {
      const materialVariable = `--novo-${material}`
      let activeBg = backgroundColor ?? `var(${materialVariable}-background)`
      let activeBorder = `var(${materialVariable}-border)`
      let activeShadow = `var(${materialVariable}-box-shadow)`

      if (backgroundColor && contrastObserver && resolvedContrast) {
        // Keep the tint near-transparent so the displacement/refraction stays
        // visible (crystal-clear look). Just enough tint to anchor the panel.
        if (resolvedContrast === 'dark') {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(20, 20, 23, 0.06)'
            : backgroundColor
          activeBorder = '1px solid transparent'
          activeShadow = '0 24px 80px rgba(0,0,0,0.45), inset 1px 1px 0 rgba(255,255,255,0.18)'
        } else {
          activeBg = backgroundColor.includes('--md-sys-color-neutral-background')
            ? 'rgba(255, 255, 255, 0.10)'
            : backgroundColor
          activeBorder = '1px solid transparent'
          activeShadow = '0 12px 40px rgba(0,0,0,0.08), inset 1px 1px 0 rgba(255,255,255,0.6)'
        }
      }

      const baseBg: GlassBackdropStyle = {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none',
        zIndex: 0,
        '--novo-glass-background': activeBg,
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

      return {
        ...baseBg,
        '--novo-glass-backdrop-filter': `var(${materialVariable}-backdrop-filter)`,
      }
    }, [
      backgroundColor,
      elevation,
      contrastObserver,
      resolvedContrast,
      debug,
      mapUrl,
      material,
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
          material === 'focus' ? 'novo-focus-surface' : 'novo-context-glass',
          className,
        )}
        style={{ ...computedStyle, ...style }}
        {...rest}
      >
        {/* Liquid Glass Background Layer */}
        <div aria-hidden data-glass-backdrop className="novo-glass-backdrop" style={bgStyles} />

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
