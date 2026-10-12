import {
  criticalSpring,
  SHARED_SURFACE_SHAPES,
  SHARED_SURFACE_TIMING,
} from '@/hooks/use-shared-surface-morph'
import { getSharedSurfaceMorphEase, withSharedSurfaceBounce } from '@/lib/modal-motion'

describe('shared surface morph contract', () => {
  it('uses the delivered critical spring and settles at one', () => {
    const ease = criticalSpring(7.35)
    expect(ease(0)).toBeCloseTo(0, 8)
    expect(ease(1)).toBeCloseTo(1, 8)
    expect(ease(0.5)).toBeGreaterThan(0.8)
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

  it('keeps one final-size stage while clipping each presentation shape', () => {
    expect(SHARED_SURFACE_SHAPES.expanded).toEqual({ width: 360, height: 420, radius: 28 })
    expect(SHARED_SURFACE_SHAPES.capsule.radius).toBe(9999)
    expect(SHARED_SURFACE_TIMING.full).toEqual({ open: 0.59, close: 0.52 })
    expect(SHARED_SURFACE_TIMING.reduced).toEqual({ open: 0.18, close: 0.16 })
  })
})
