import { buildLiquidNoticeGeometry, getLiquidNoticeLayout, liquidNeckProfile } from '@/lib/liquid-notification'

describe('liquid notification flight geometry', () => {
  const source = { left: 1220, top: 16, width: 36, height: 36 }
  const viewport = { width: 1280, height: 800 }

  it('grows a stretched drop and neck, then releases into the exact final card', () => {
    const layout = getLiquidNoticeLayout(source, viewport, 'below')
    const initial = buildLiquidNoticeGeometry(0, 0, layout)
    const stretching = buildLiquidNoticeGeometry(0.4, 0, layout)
    const detached = buildLiquidNoticeGeometry(0.85, 0.2, layout)
    const final = buildLiquidNoticeGeometry(1, 1, layout)
    expect(initial.width).toBe(0)
    expect(initial.neckWidth).toBe(0)
    expect(stretching.height).toBeGreaterThan(stretching.width)
    expect(stretching.neckWidth).toBeGreaterThan(20)
    expect(detached.neckWidth).toBe(0)
    expect(final).toMatchObject({ x: layout.card.left, y: layout.card.top, width: layout.card.width, height: layout.card.height, offsetX: 0, offsetY: 0, neckWidth: 0 })
  })

  it('keeps each phase finite and nonnegative while the springs overshoot', () => {
    const layout = getLiquidNoticeLayout(source, viewport, 'below')
    for (const drop of [-0.03, 0, 0.3, 0.82, 1, 1.06]) {
      for (const expand of [-0.02, 0, 0.5, 1, 1.06]) {
        const g = buildLiquidNoticeGeometry(drop, expand, layout)
        expect(Object.values(g).every(Number.isFinite)).toBe(true)
        expect(g.width).toBeGreaterThanOrEqual(0)
        expect(g.height).toBeGreaterThanOrEqual(0)
        expect(g.radius).toBeGreaterThanOrEqual(0)
        expect(g.radius).toBeLessThanOrEqual(Math.min(g.width, g.height) / 2)
      }
    }
  })

  it('turns the flight toward the Hub without moving the origin or distorting final dimensions', () => {
    const hub = { left: 1234, top: 80, width: 46, height: 190 }
    const layout = getLiquidNoticeLayout(hub, viewport, 'left', 148)
    const stretching = buildLiquidNoticeGeometry(0.4, 0, layout)
    const settled = buildLiquidNoticeGeometry(1, 1, layout)
    expect(layout.side).toBe('left')
    expect(layout.card.left + layout.card.width + 34).toBe(hub.left)
    expect(stretching.width).toBeGreaterThan(stretching.height)
    expect(settled.x).toBeCloseTo(layout.card.left)
    expect(settled.y).toBeCloseTo(layout.card.top)
    expect(liquidNeckProfile(1.6 / 3)).toBeCloseTo(1)
  })

  it('fits long notices at 320px and within a resized visual viewport', () => {
    const layout = getLiquidNoticeLayout({ left: 274, top: 240, width: 46, height: 190 }, { width: 320, height: 380 }, 'left', 500)
    expect(layout.side).toBe('below')
    expect(layout.card.left).toBeGreaterThanOrEqual(16)
    expect(layout.card.left + layout.card.width).toBeLessThanOrEqual(304)
    expect(layout.card.top + layout.card.height).toBeLessThanOrEqual(364)
  })
})
