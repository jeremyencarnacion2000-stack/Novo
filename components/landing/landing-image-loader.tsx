'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

type LoaderFrame = {
  src: string
  position: string
}

/* The loader has a fixed, non-repeating 16-frame story. Keeping the manifest
   explicit makes the choreography deterministic across devices and prevents a
   product screenshot or a repeated scene from slipping into the sequence. */
const LOADER_COLUMNS: readonly (readonly LoaderFrame[])[] = [
  [
    { src: '/landing/loader-optimized/novo-loader-signal-v1.webp', position: '68% 50%' },
    { src: '/landing/loader-optimized/novo-loader-envelope-v1.webp', position: '52% 50%' },
    { src: '/landing/loader-optimized/novo-loader-context-v1.webp', position: '62% 50%' },
    { src: '/landing/loader-optimized/novo-loader-signal-cloud-v1.webp', position: '50% 50%' },
  ],
  [
    { src: '/landing/loader-optimized/novo-loader-memory-v1.webp', position: '58% 50%' },
    { src: '/landing/loader-optimized/novo-loader-clock-v1.webp', position: '51% 50%' },
    { src: '/landing/loader-optimized/novo-loader-direction-v1.webp', position: '49% 50%' },
    { src: '/landing/loader-optimized/novo-loader-notebook-v1.webp', position: '48% 50%' },
  ],
  [
    { src: '/landing/loader-optimized/novo-loader-botanical-brain-v1.webp', position: '50% 50%' },
    { src: '/landing/loader-optimized/novo-loader-constellation-v1.webp', position: '50% 50%' },
    { src: '/landing/loader-optimized/novo-loader-memory-vessel-v1.webp', position: '50% 50%' },
    { src: '/landing/loader-optimized/novo-loader-calendar-flag-v1.webp', position: '52% 50%' },
  ],
  [
    { src: '/landing/loader-optimized/novo-loader-brain-path-v1.webp', position: '54% 50%' },
    { src: '/landing/loader-optimized/novo-loader-moon-mountains-v1.webp', position: '54% 50%' },
    { src: '/landing/loader-optimized/novo-loader-compass-v1.webp', position: '50% 50%' },
    { src: '/landing/loader-optimized/novo-loader-thread-cards-v1.webp', position: '50% 50%' },
  ],
]

const SWEEP_DURATION = 2
// Keep the original overlapping editorial cadence: a new scene joins the
// column before the preceding scene has entirely left it. The small offset
// makes the four strips feel like a single coordinated reveal, not four loops.
const IMAGE_STAGGER = 0.42
const COLUMN_OFFSET = 0.14
const CURTAIN_STAGGER = 0.12

export function LandingImageLoader({ onComplete }: { onComplete?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let mounted = true
    const compactReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      window.matchMedia('(max-width: 1023px)').matches

    if (compactReducedMotion) {
      const frame = window.requestAnimationFrame(() => {
        if (!mounted) return
        onComplete?.()
        setVisible(false)
      })
      return () => {
        mounted = false
        window.cancelAnimationFrame(frame)
      }
    }

    const context = gsap.context(() => {
      const columns = gsap.utils.toArray<HTMLElement>('[data-loader-column]', root)

      gsap.set(root, { visibility: 'visible', pointerEvents: 'auto' })
      gsap.set(columns, {
        height: '100%',
        transformOrigin: 'bottom center',
        force3D: true,
      })

      const timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: () => {
          onComplete?.()
          if (mounted) setVisible(false)
        },
      })

      columns.forEach((column, columnIndex) => {
        const frames = gsap.utils.toArray<HTMLElement>('[data-loader-image]', column)

        // Four frames per column, all staged beyond the left edge. The tween
        // below is deliberately expressed as a GSAP stagger so its timing is
        // the authored -100% → 0% → 100% image procession, not a fade.
        gsap.set(frames, { xPercent: -108, autoAlpha: 0, force3D: true })

        // Setting opacity before the images travel is safe: they remain
        // outside the clipped column until their own stagger begins.
        timeline
          .set(
            frames,
            {
              autoAlpha: 1,
              willChange: 'transform',
              zIndex: (index: number) => index + 1,
            },
            columnIndex * COLUMN_OFFSET,
          )
          .to(
            frames,
            {
              xPercent: 108,
              duration: SWEEP_DURATION,
              ease: 'power2.inOut',
              force3D: true,
              stagger: { each: IMAGE_STAGGER, from: 'start' },
            },
            columnIndex * COLUMN_OFFSET,
          )
      })

      const finalSweepEnd =
        SWEEP_DURATION +
        IMAGE_STAGGER * (LOADER_COLUMNS[0].length - 1) +
        COLUMN_OFFSET * (LOADER_COLUMNS.length - 1)

      // The exit is intentionally reversed: the rightmost strip lifts first,
      // then the remaining columns follow as one vertical curtain. Height is
      // the only reveal property: no root or hero opacity is animated.
      timeline
        .to(
          columns,
          {
            height: '0%',
            duration: 0.72,
            ease: 'power4.inOut',
            stagger: { each: CURTAIN_STAGGER, from: 'end' },
          },
          finalSweepEnd + 0.04,
        )
        .set(root, { display: 'none', pointerEvents: 'none' })
    }, root)

    return () => {
      mounted = false
      context.revert()
    }
  }, [])

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[10000] grid h-[100dvh] w-full grid-cols-4 overflow-hidden bg-black"
      aria-busy="true"
      aria-label="Preparing Novo"
      role="status"
    >
      <span className="sr-only">Preparing Novo</span>
      {LOADER_COLUMNS.map((frames, columnIndex) => (
        <div
          key={columnIndex}
          data-loader-column
          className="relative h-full min-h-0 overflow-hidden bg-black"
        >
          {frames.map((frame, frameIndex) => (
            <div
              key={frame.src}
              data-loader-image
              className="absolute inset-y-0 left-0 h-full w-full overflow-hidden [contain:layout_paint]"
              style={{ transform: 'translate3d(-108%, 0, 0)' }}
            >
              <img
                src={frame.src}
                alt=""
                aria-hidden="true"
                decoding="async"
                draggable={false}
                // The loader owns the first visual beat of the landing. Keep
                // every frame eager so a slow connection can never reveal an
                // empty strip while the GSAP sweep is already in motion. The
                // optimized set is only ~0.82 MB; only the leading frame in
                // each column receives high network priority.
                loading="eager"
                fetchPriority={frameIndex === 0 ? 'high' : 'low'}
                className="h-full w-full select-none object-cover"
                style={{ objectPosition: frame.position, transform: 'translateZ(0)' }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
