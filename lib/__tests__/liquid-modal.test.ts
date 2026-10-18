import { buildLiquidModalGeometry, getLiquidModalBounds, LIQUID_MODAL, resolveLiquidModalSource } from '@/lib/liquid-modal'

const target = { left: 300, top: 180, width: 420, height: 360 }
const source = { left: 30, top: 50, width: 100, height: 44 }

describe('liquid modal geometry', () => {
  it('starts at its exact source and finishes at its final layout', () => {
    expect(buildLiquidModalGeometry(0, source, target, 16, 28)).toMatchObject({ ...source, radius: 16, reveal: 0 })
    expect(buildLiquidModalGeometry(1, source, target, 16, 28)).toMatchObject({ ...target, radius: 28, reveal: 1, neck: 0 })
  })

  it('forms a finite detached drop with a neck that disappears before content appears', () => {
    const early = buildLiquidModalGeometry(0.2, source, target, 16, 28)
    expect(early.neck).toBeGreaterThan(0)
    expect(early.width).toBeLessThan(target.width)
    expect(buildLiquidModalGeometry(0.85, source, target, 16, 28).neck).toBe(0)
    for (const p of [-1, 0, 0.2, 0.5, 0.99, 1, 2]) {
      const frame = buildLiquidModalGeometry(p, source, target, 16, 28)
      for (const value of Object.values(frame)) expect(Number.isFinite(value)).toBe(true)
      expect(frame.width).toBeGreaterThan(0)
      expect(frame.height).toBeGreaterThan(0)
    }
  })

  it('reveals the content before the shared surface finishes opening and uses the same spring both ways', () => {
    expect(buildLiquidModalGeometry(0.6, source, target, 16, 28).reveal).toBeGreaterThan(0)
    expect(LIQUID_MODAL.closeResponse).toBe(LIQUID_MODAL.response)
  })

  it('uses a local bloom when there is no real visible source', () => {
    expect(resolveLiquidModalSource(null, target)).toEqual({ left: 484, top: 334, width: 52, height: 52 })
    expect(resolveLiquidModalSource({ left: 0, top: 0, width: 0, height: 0 }, target)).toEqual(resolveLiquidModalSource(null, target))
  })

  it('bounds expensive goo work to the source/target union and its small blur margin', () => {
    expect(getLiquidModalBounds(source, target)).toEqual({ left: 6, top: 26, width: 738, height: 538 })
  })
})
