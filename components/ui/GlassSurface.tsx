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
 *  • Keeps compositor hints scoped to active motion instead of reserving a
 *    permanent GPU layer for every card.
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
import type { RefractivePriority } from '@/lib/liquid-glass/liquid-glass-budget'

export type GlassPreset = 'navigation' | 'status' | 'control' | 'panel'
export type { RefractivePriority }

const glassPresets: Record<GlassPreset, {
  radius: number
  depth: number
  blur: number
  strength: number
  chromaticAberration: number
}> = {
  // These are the calibrated values from the supplied GlassElement variant:
  // a light 5px RGB split for compact controls and a 15px split for focal
  // lenses. The distinction keeps navigation calm while making the Twin pill
  // and Context Hub visibly refractive instead of merely translucent.
  navigation: { radius: 32, depth: 10, blur: 1, strength: 100, chromaticAberration: 5 },
  status: { radius: 64, depth: 10, blur: 1, strength: 100, chromaticAberration: 15 },
  control: { radius: 32, depth: 10, blur: 1, strength: 100, chromaticAberration: 5 },
  panel: { radius: 64, depth: 10, blur: 1, strength: 100, chromaticAberration: 15 },
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GlassSurfaceProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Semantic shape/material calibration; pass `refractive` to mount an SVG lens. */
  preset?: GlassPreset

  /** Priority within Novo's five-filter high-fidelity rendering budget. */
  refractivePriority?: RefractivePriority

  /** Releases high-fidelity resources while preserving the mounted fallback. */
  refractiveActive?: boolean
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

  /** Enable the heavier SVG displacement/refraction layer for focal surfaces. */
  refractive?: boolean

  /** Use the supplied vanilla <glass-element> renderer for this focal lens. */
  webComponent?: boolean
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
      preset,
      radius: radiusProp,
      depth: depthProp,
      blur: blurProp,
      strength: strengthProp,
      chromaticAberration: chromaticAberrationProp,
      adaptive = true,
      debug = false,
      backgroundColor,
      material = 'context',
      elevation = 'medium',
      as,
      contrastObserver = false,
      autoSize = true,
      refractive: refractiveProp,
      refractivePriority = 'ambient',
      refractiveActive = true,
      webComponent = false,
      width: staticWidth,
      height: staticHeight,
      className,
      style,
      children,
      ...rest
    },
    forwardedRef,
  ) {
    const resolvedPreset = preset as GlassPreset | undefined
    const presetValues = resolvedPreset ? glassPresets[resolvedPreset] : undefined
    const radius = radiusProp ?? presetValues?.radius ?? 128
    const depth = depthProp ?? presetValues?.depth ?? 6
    const blur = blurProp ?? presetValues?.blur ?? 1
    const strength = strengthProp ?? presetValues?.strength ?? 40
    const chromaticAberration = chromaticAberrationProp ?? presetValues?.chromaticAberration ?? 6

    // The supplied <glass-element> is loaded lazily by the app shell. Keep
    // the React lens alive until the custom element is actually upgraded so
    // Chromium never paints an unupgraded placeholder over the glass.
    const [webComponentReady, setWebComponentReady] = React.useState(() =>
      typeof window !== 'undefined' &&
      typeof customElements !== 'undefined' &&
      Boolean(customElements.get('glass-element')),
    )
    React.useEffect(() => {
      if (!webComponent || typeof window === 'undefined' || typeof customElements === 'undefined') return
      let cancelled = false
      const markReady = () => { if (!cancelled) setWebComponentReady(true) }
      if (customElements.get('glass-element')) markReady()
      else customElements.whenDefined('glass-element').then(markReady).catch(() => {})
      window.addEventListener('novo:liquid-glass-ready', markReady)
      return () => {
        cancelled = true
        window.removeEventListener('novo:liquid-glass-ready', markReady)
      }
    }, [webComponent])

    const webComponentPreferred = webComponent && webComponentReady
    // A preset selects geometry and material tokens; it must not implicitly
    // allocate an SVG displacement lens. Refraction is intentionally opt-in.
    const refractive = refractiveProp ?? false
    const {
      ref: internalRef,
      mapUrl,
      filterUrl,
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
      enabled: refractive,
      leaseOnly: webComponentPreferred,
      priority: refractivePriority,
      active: refractiveActive,
      includeMap: debug,
    })
    const webComponentActive = webComponentPreferred && refractive && refractiveActive && useSVGFilter

    // Keep the optical chain identical to the reference Liquid Glass
    // renderer: a light pre-blur, the geometry-aware SVG displacement lens,
    // then a restrained post-blur/brightness/saturation pass.  The hook also
    // returns the CSS-only fallback for Safari/Firefox or when the five-lens
    // budget is occupied, so the material never flashes flat.
    const refractiveFilter = React.useMemo(
      () => buildBackdropFilter(),
      [buildBackdropFilter],
    )

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

    const webComponentRef = React.useRef<HTMLElement | null>(null)

    // Keep the supplied web component's SVG map aligned with the actual host
    // geometry. Layout effect + custom-element readiness prevents a first-paint
    // 200x200 lens and keeps the exact delivered displacement renderer visible.
    React.useLayoutEffect(() => {
      if (!webComponentActive) return
      const host = internalRef.current
      const lens = webComponentRef.current
      if (!host || !lens) return

      const setIfChanged = (name: string, value: string) => {
        if (lens.getAttribute(name) !== value) lens.setAttribute(name, value)
      }
      let lastGeometry = ''
      const syncGeometry = () => {
        // A morph transforms the optical shell on the compositor. Its map
        // must describe the untransformed layout, otherwise a lens mounted
        // mid-flight freezes at that frame's squashed viewport dimensions.
        const layoutWidth = host.offsetWidth
        const layoutHeight = host.offsetHeight
        if (layoutWidth <= 0 || layoutHeight <= 0) return
        const width = String(layoutWidth)
        const height = String(layoutHeight)
        const radiusValue = String(Math.min(radius, layoutWidth / 2, layoutHeight / 2))
        const background = backgroundColor && backgroundColor !== 'transparent'
          ? backgroundColor
          : 'rgba(255,255,255,0.10)'
        const geometry = `${width}|${height}|${radiusValue}|${depth}|${blur}|${strength}|${chromaticAberration}|${background}`
        if (geometry === lastGeometry) return
        lastGeometry = geometry
        setIfChanged('width', width)
        setIfChanged('height', height)
        setIfChanged('radius', radiusValue)
        setIfChanged('depth', String(depth))
        setIfChanged('blur', String(blur))
        setIfChanged('strength', String(strength))
        setIfChanged('chromatic-aberration', String(chromaticAberration))
        setIfChanged('background-color', background)
      }

      // Set the first geometry synchronously so the lens never flashes at its
      // default 200×200 size, then ignore duplicate ResizeObserver callbacks.
      syncGeometry()
      const observer = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(syncGeometry)
      observer?.observe(host)
      window.addEventListener('resize', syncGeometry, { passive: true })
      return () => {
        observer?.disconnect()
        window.removeEventListener('resize', syncGeometry)
      }
    }, [webComponentActive, internalRef, radius, depth, blur, strength, chromaticAberration, backgroundColor])

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
        // Do not isolate this host: the Settings-controlled backdrop lives in
        // a child layer and must be able to sample the wallpaper outside the
        // card. `isolation: isolate` turns the transparent host into the
        // child's backdrop root in Chromium, making a valid blur token look
        // visually flat on desktop.
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        // The delivered Web Component is the sole optical compositor when
        // active. Leaving the host backdrop-filter enabled would blur the
        // backdrop once, then refract that already-composited result again.
        backdropFilter: webComponentActive ? 'none' : undefined,
        WebkitBackdropFilter: webComponentActive ? 'none' : undefined,
      }
    }, [radius, webComponentActive])
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
        // Keep the Settings material as a standalone declaration. The SVG
        // lens is rendered in a separate overlay below so an unsupported or
        // temporarily invalid SVG URL can never disable the configured blur.
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
      filterUrl,
      refractive,
    ])

    const Component = as || 'div'

    return (
      <Component
        ref={ref}
        data-novo-glass
        data-glass-preset={resolvedPreset}
        data-refractive-priority={refractivePriority}
        data-liquid-refractive={refractive ? (useSVGFilter ? 'svg' : 'fallback') : 'off'}
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
        {/* Liquid Glass Background Layer. The supplied web component owns
            the complete optical stack when active; keeping this backdrop
            mounted would create the visible double-plate effect on mobile. */}
        {!webComponentActive && (
          <div aria-hidden data-glass-backdrop className="novo-glass-backdrop" style={bgStyles} />
        )}

        {webComponentActive && React.createElement('glass-element', {
          // The supplied element exposes optical values through read-only
          // getters. Passing width/radius/etc. as React props makes React
          // assign properties and throws before the custom element can paint.
          // Geometry and optical attributes are synchronously applied through
          // setAttribute in the layout effect above instead.
          ref: webComponentRef,
          'aria-hidden': 'true',
          style: {
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 0,
          },
        })}
        {/* Optional refractive lens. It is deliberately separate from the
            Settings-controlled backdrop layer: Chromium can reject a mixed
            `url(#filter) blur(...)` declaration as a whole, which would make
            a transparent card lose its blur. */}
        {refractive && !webComponentActive && (
          <div
            aria-hidden
            data-glass-refractive
            data-glass-refractive-mode={useSVGFilter && filterUrl ? 'svg' : 'css'}
            className="novo-glass-refractive"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              pointerEvents: 'none',
              zIndex: 0,
              // Keep the lens subordinate to the Settings material contract.
              // A fixed opacity made the refractive layer visually overpower
              // the user-controlled card blur, especially on large dashboard
              // cards where the backdrop itself is subtle.
              '--novo-glass-refractive-opacity': `var(--novo-${material}-refractive-opacity, 0.72)`,
              // Keep a restrained CSS optical fallback mounted when the
              // browser cannot use an SVG filter or its finite lens budget is
              // occupied. The configured backdrop blur remains underneath;
              // this layer contributes only depth, an inner highlight and a
              // gentle spectral edge instead of pretending that no material
              // exists at all.
              '--novo-glass-refractive-filter': refractiveFilter || 'none',
              // Keep the critical compositor declaration inline as well as in
              // the CSS token. Chromium can otherwise drop a `url(#...)`
              // value during a stylesheet cascade when the lens is mounted
              // inside a transformed portal. The token remains the fallback
              // contract; the inline declaration makes the SVG resource
              // resolvable on the first paint.
              ...(refractiveFilter
                ? {
                    backdropFilter: refractiveFilter,
                    WebkitBackdropFilter: refractiveFilter,
                  }
                : {}),
            } as React.CSSProperties & {
              '--novo-glass-refractive-opacity': string
              '--novo-glass-refractive-filter': string
            }}
          />
        )}

        {/* The specular edge belongs to the same material contract as the
            lens. This prevents a fixed white rim from surviving after the
            user turns the card's opacity or liquid intensity down to zero. */}
        {!webComponentActive && (
        <div
          aria-hidden
          data-glass-sheen
          className="novo-glass-sheen"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 1,
            '--novo-glass-sheen-opacity': refractive
              ? `calc(var(--novo-${material}-refractive-opacity, 0.72) * 0.46)`
              : '0',
          } as React.CSSProperties & { '--novo-glass-sheen-opacity': string }}
        />
        )}

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
