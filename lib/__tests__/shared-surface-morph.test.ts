import {
  criticalSpring,
  SHARED_SURFACE_SHAPES,
  SHARED_SURFACE_TIMING,
  useSharedSurfaceMorph,
  type SharedSurfaceMorphState,
} from '@/hooks/use-shared-surface-morph'
import { renderHook } from '@testing-library/react'
import { getSharedSurfaceMorphEase, withSharedSurfaceBounce } from '@/lib/modal-motion'
import { Spring, Tracked } from '@/lib/hub-surface-motion'

describe('shared surface morph contract', () => {
  it('uses the Companion opening spring and its 340ms closing curve', () => {
    const spring = new Spring(46)
    spring.target = 360
    expect(spring.omega).toBeCloseTo(2 * Math.PI / 0.5)
    expect(spring.zeta).toBe(0.72)
    for (let step = 0; step < 360; step += 1) spring.step(1 / 240)
    expect(spring.value).toBeCloseTo(360, 2)

    const width = new Tracked(360)
    width.curveTowards(46, 340, 0)
    width.step(0.016, 170)
    expect(width.value).toBeGreaterThan(46)
    expect(width.value).toBeLessThan(360)
    const visibleValue = width.value
    width.springTo(360)
    expect(width.value).toBe(visibleValue)
    width.curveTowards(46, 340, 170)
    width.step(0.016, 510)
    expect(width.value).toBeCloseTo(46, 4)
    expect(width.animating).toBe(false)
  })

  it('adds a small end-of-morph overshoot and return without changing the settled value', () => {
    const base = criticalSpring(7.35)
    const bounced = withSharedSurfaceBounce(base)

    expect(bounced(0)).toBeCloseTo(0, 8)
    expect(bounced(0.8)).toBeGreaterThan(1)
    expect(bounced(0.94)).toBeLessThan(base(0.94))
    expect(bounced(1)).toBeCloseTo(1, 8)
  })

  it('gives the Hub and navigation morph a visible rebound before settling', () => {
    for (const omega of [7.35, 8.15]) {
      const base = criticalSpring(omega)
      const bounced = withSharedSurfaceBounce(base)

      expect(bounced(0.8)).toBeGreaterThan(base(0.8) + 0.1)
      expect(bounced(1)).toBeCloseTo(1, 8)
    }
  })

  it('uses the same opening and return spring for both shared surfaces', () => {
    expect(getSharedSurfaceMorphEase('open')(0.5)).toBeCloseTo(
      withSharedSurfaceBounce(criticalSpring(7.35))(0.5),
      8,
    )
    expect(getSharedSurfaceMorphEase('close')(0.5)).toBeCloseTo(
      withSharedSurfaceBounce(criticalSpring(8.15))(0.5),
      8,
    )
    expect(getSharedSurfaceMorphEase('close')(0.8)).toBeGreaterThan(1)
  })

  it('keeps the reference dimensions for each presentation', () => {
    expect(SHARED_SURFACE_SHAPES.expanded).toEqual({ width: 360, height: 420, radius: 28 })
    expect(SHARED_SURFACE_SHAPES.capsule.radius).toBe(9999)
    expect(SHARED_SURFACE_TIMING.full).toEqual({ open: 0.59, close: 0.52 })
    expect(SHARED_SURFACE_TIMING.reduced).toEqual({ open: 0.18, close: 0.16 })
  })

  it('does not leave a Backdrop Root around the Hub lens in any settled shape', () => {
    const matchMedia = window.matchMedia
    window.matchMedia = jest.fn().mockReturnValue({ matches: false })
    document.documentElement.dataset.novoMotion = 'off'
    const surface = document.createElement('div')
    surface.style.clipPath = 'inset(0px)'
    surface.style.filter = 'blur(0px)'
    document.body.append(surface)
    const surfaceRef = { current: surface }
    const { rerender, unmount } = renderHook(({ state }: { state: SharedSurfaceMorphState }) => useSharedSurfaceMorph({ surfaceRef, state }), { initialProps: { state: 'idle' as SharedSurfaceMorphState } })
    for (const state of ['idle', 'capsule', 'expanded'] as const) {
      rerender({ state })
      expect(surface.style.width).toBe(`${SHARED_SURFACE_SHAPES[state].width}px`)
      expect(surface.style.height).toBe(`${SHARED_SURFACE_SHAPES[state].height}px`)
      expect(surface.style.clipPath).toBe('')
      expect(surface.style.filter).toBe('')
      expect(surface.style.opacity).toBe('1')
      expect(surface.style.willChange).toBe('auto')
    }
    unmount()
    surface.remove()
    delete document.documentElement.dataset.novoMotion
    window.matchMedia = matchMedia
  })
})
