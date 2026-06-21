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
   * @default 28
   */
  radius?: number

  /**
   * Material depth: controls how far the blurred inner rect is inset.
   * Larger values = more pronounced lensing at the edges.
   * @default 16
   */
  depth?: number

  /**
   * Pre/post blur in pixels applied to the backdrop-filter chain.
   * @default 20
   */
  blur?: number

  /**
   * Base displacement scale for feDisplacementMap.
   * @default 90
   */
  strength?: number

  /**
   * Chromatic aberration spread. 0 = disabled.
   * Each RGB channel displaces at strength + ca*2, strength + ca, strength.
   * @default 1.5
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
   * @default 'rgba(255, 255, 255, 0.18)'
   */
  backgroundColor?: string

  /**
   * Elevation tier — affects shadow intensity.
   * @default 'medium'
   */
  elevation?: 'low' | 'medium' | 'high'
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
      radius = 28,
      depth = 16,
      blur = 20,
      strength = 90,
      chromaticAberration = 1.5,
      adaptive = true,
      debug = false,
      backgroundColor = 'rgba(255, 255, 255, 0.18)',
      elevation = 'medium',
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
    })

    // Merge forwarded ref with internal ResizeObserver ref
    const ref = React.useCallback(
      (node: HTMLDivElement | null) => {
        ;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [internalRef, forwardedRef],
    )

    // ── Build inline styles ──────────────────────────────────────────────────

    const computedStyle = React.useMemo<React.CSSProperties>(() => {
      const base: React.CSSProperties = {
        borderRadius: radius,
        // GPU layers — only these properties are ever animated
        willChange: 'transform, opacity, filter, backdrop-filter',
        // These must NOT be animated — only the above GPU props are
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        // Transition: only GPU-safe props
        transition: 'backdrop-filter 200ms ease, filter 200ms ease, opacity 200ms ease, transform 200ms ease',
      }

      if (debug && mapUrl) {
        // Show the raw displacement map
        return {
          ...base,
          backgroundImage: `url("${mapUrl}")`,
          backgroundSize: '100% 100%',
          boxShadow: 'none',
          backdropFilter: 'none',
        }
      }

      if (!hasSVGFilterSupport || !filterUrl) {
        // Fallback: simple backdrop blur (no SVG filter)
        return {
          ...base,
          backdropFilter: `blur(${blur * 2}px)`,
          background: backgroundColor,
          boxShadow: elevationShadow[elevation],
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }
      }

      // Full Liquid Glass pipeline
      return {
        ...base,
        backdropFilter: buildBackdropFilter(),
        background: backgroundColor,
        boxShadow: elevationShadow[elevation],
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }
    }, [
      radius,
      debug,
      mapUrl,
      hasSVGFilterSupport,
      filterUrl,
      blur,
      backgroundColor,
      elevation,
      buildBackdropFilter,
    ])

    return (
      <div
        ref={ref}
        data-novo-glass
        data-elevation={elevation}
        className={cn(
          // Layout — nothing in here animates
          'flex flex-col',
          className,
        )}
        style={{ ...computedStyle, ...style }}
        {...rest}
      >
        {/* Inner edge highlight — rendered as a separate non-layout layer */}
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
      </div>
    )
  },
)

GlassSurface.displayName = 'GlassSurface'

export { GlassSurface }
export default GlassSurface
