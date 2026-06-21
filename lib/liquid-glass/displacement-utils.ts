/**
 * Novo Official Liquid Glass — Displacement Utilities
 *
 * Direct port of https://github.com/srdavo/liquid-glass (displacement-utils.js)
 * adapted for TypeScript / Next.js / React.
 *
 * The SVG pipeline:
 *   getDisplacementMap  → raw displacement texture (data URI)
 *   getDisplacementFilter → full SVG <filter> with feImage + feDisplacementMap
 *                           + RGB chromatic aberration via feColorMatrix / feBlend
 *
 * NEVER use static textures. NEVER simulate chromatic aberration in CSS.
 * All distortion is performed inside the SVG filter pipeline.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DisplacementMapParams {
  height: number
  width: number
  radius: number
  depth: number
}

export interface DisplacementFilterParams extends DisplacementMapParams {
  /** Base displacement scale. Default: 100 */
  strength?: number
  /** Chromatic aberration spread (0 = off). Default: 0 */
  chromaticAberration?: number
}

// ─── Core: getDisplacementMap ─────────────────────────────────────────────────

/**
 * Generates the SVG displacement texture used by feDisplacementMap.
 *
 * Two linear gradients are created:
 *   #Y — vertical green gradient (drives Y-channel displacement)
 *   #X — horizontal red gradient  (drives X-channel displacement)
 *
 * They are composited via mix-blend-mode: screen over a navy base.
 * A blurred rounded rect punched in with the material depth preserves
 * geometry fidelity at the border radius.
 *
 * Returns a `data:image/svg+xml;utf8,...` URL suitable for <feImage href>.
 */
export function getDisplacementMap({
  height,
  width,
  radius,
  depth,
}: DisplacementMapParams): string {
  const svg = `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .mix { mix-blend-mode: screen; }
    </style>
    <defs>
      <linearGradient
        id="Y"
        x1="0"
        x2="0"
        y1="${Math.ceil((radius / height) * 15)}%"
        y2="${Math.floor(100 - (radius / height) * 15)}%">
        <stop offset="0%"   stop-color="#0F0" />
        <stop offset="100%" stop-color="#000" />
      </linearGradient>
      <linearGradient
        id="X"
        x1="${Math.ceil((radius / width) * 15)}%"
        x2="${Math.floor(100 - (radius / width) * 15)}%"
        y1="0"
        y2="0">
        <stop offset="0%"   stop-color="#F00" />
        <stop offset="100%" stop-color="#000" />
      </linearGradient>
    </defs>

    <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#Y)" class="mix" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#X)" class="mix" />
      <rect
        x="${depth}"
        y="${depth}"
        height="${height - 2 * depth}"
        width="${width - 2 * depth}"
        fill="#808080"
        rx="${radius}"
        ry="${radius}"
        filter="blur(${depth}px)"
      />
    </g>
  </svg>`

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// ─── Core: getDisplacementFilter ─────────────────────────────────────────────

/**
 * Generates a complete SVG <filter id="displace"> that:
 *
 *  1. Loads the displacement map via <feImage href="{getDisplacementMap(...)}" result="displacementMap">
 *  2. Applies three independent <feDisplacementMap> passes for R, G, B channels
 *     (each at a slightly different scale to create chromatic aberration)
 *  3. Extracts each channel with <feColorMatrix result="displacedR/G/B">
 *  4. Merges them back with <feBlend mode="screen">
 *
 * This is the mandatory SVG pipeline. Chromatic aberration is NOT done in CSS.
 *
 * Returns a `data:image/svg+xml;utf8,...#displace` URL suitable for
 * `backdrop-filter: url('...')` or `filter: url('...')`.
 */
export function getDisplacementFilter({
  height,
  width,
  radius,
  depth,
  strength = 100,
  chromaticAberration = 0,
}: DisplacementFilterParams): string {
  const displacementMapUrl = getDisplacementMap({ height, width, radius, depth })

  const svg = `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="displace" color-interpolation-filters="sRGB">
        <!-- Step 1: load displacement texture -->
        <feImage
          x="0" y="0"
          height="${height}" width="${width}"
          href="${displacementMapUrl}"
          result="displacementMap"
        />

        <!-- Step 2a: RED channel — highest displacement (most aberrated) -->
        <feDisplacementMap
          transform-origin="center"
          in="SourceGraphic"
          in2="displacementMap"
          scale="${strength + chromaticAberration * 2}"
          xChannelSelector="R"
          yChannelSelector="G"
        />
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 1 0"
          result="displacedR"
        />

        <!-- Step 2b: GREEN channel — middle displacement -->
        <feDisplacementMap
          in="SourceGraphic"
          in2="displacementMap"
          scale="${strength + chromaticAberration}"
          xChannelSelector="R"
          yChannelSelector="G"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0
                  0 1 0 0 0
                  0 0 0 0 0
                  0 0 0 1 0"
          result="displacedG"
        />

        <!-- Step 2c: BLUE channel — base displacement (least aberrated) -->
        <feDisplacementMap
          in="SourceGraphic"
          in2="displacementMap"
          scale="${strength}"
          xChannelSelector="R"
          yChannelSelector="G"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 1 0 0
                  0 0 0 1 0"
          result="displacedB"
        />

        <!-- Step 3: Composite RGB channels back together via screen blend -->
        <feBlend in="displacedR" in2="displacedG" mode="screen" />
        <feBlend in2="displacedB" mode="screen" />
      </filter>
    </defs>
  </svg>`

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '#displace'
}

// ─── Global API ───────────────────────────────────────────────────────────────

/**
 * Exposes DisplacementUtils on the global window object for backward-compat
 * with any vanilla JS code that calls window.DisplacementUtils.getDisplacementFilter(...)
 */
declare global {
  interface Window {
    DisplacementUtils: {
      getDisplacementMap: typeof getDisplacementMap
      getDisplacementFilter: typeof getDisplacementFilter
    }
  }
}

if (typeof window !== 'undefined') {
  window.DisplacementUtils = {
    getDisplacementMap,
    getDisplacementFilter,
  }
}
