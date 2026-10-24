import {
  LiquidNavigationMotion,
  createLiquidNavigationPath,
  NAV_LIQUID_MOTION,
  type LiquidNavigationRect,
} from '../liquid-navigation-motion'

const rect = (left: number, top = 0, width = 48, height = 44): LiquidNavigationRect => ({
  left,
  top,
  width,
  height,
})

describe('LiquidNavigationMotion', () => {
  it('lets the leading edge pull ahead of the trailing edge', () => {
    const motion = new LiquidNavigationMotion()
    motion.retarget(rect(0), 'off')
    motion.retarget(rect(220))

    for (let frame = 0; frame < 8; frame += 1) motion.step(1 / 60)

    const current = motion.currentRect
    const leftProgress = current.left / 220
    const rightProgress = (current.left + current.width - 48) / 220

    expect(rightProgress).toBeGreaterThan(leftProgress)
  })

  it('swaps the leading edge to the vertical axis for a sidebar', () => {
    const motion = new LiquidNavigationMotion()
    motion.retarget(rect(0, 0), 'off')
    motion.retarget(rect(0, 200))

    for (let frame = 0; frame < 8; frame += 1) motion.step(1 / 60)

    const current = motion.currentRect
    const topProgress = current.top / 200
    const bottomProgress = (current.top + current.height - 44) / 200

    expect(bottomProgress).toBeGreaterThan(topProgress)
  })

  it('preserves edge velocity when a target changes mid-flight', () => {
    const motion = new LiquidNavigationMotion()
    motion.retarget(rect(0), 'off')
    motion.retarget(rect(280))

    for (let frame = 0; frame < 12; frame += 1) motion.step(1 / 60)

    const velocityBeforeRetarget = motion.velocity.x
    expect(velocityBeforeRetarget).toBeGreaterThan(0)

    motion.retarget(rect(-80))

    expect(motion.velocity.x).toBeCloseTo(velocityBeforeRetarget, 5)

    let reversed = false
    for (let frame = 0; frame < 60; frame += 1) {
      motion.step(1 / 60)
      reversed ||= motion.velocity.x < 0
    }
    expect(reversed).toBe(true)
  })

  it('retargets resized tabs without discarding the current velocity', () => {
    const motion = new LiquidNavigationMotion()
    motion.retarget(rect(0), 'off')
    motion.retarget(rect(280))
    for (let frame = 0; frame < 12; frame += 1) motion.step(1 / 60)
    const velocityBeforeResize = motion.velocity.x

    motion.retarget(rect(280, 0, 84, 52))

    expect(motion.velocity.x).toBeCloseTo(velocityBeforeResize, 5)
    for (let frame = 0; frame < 120; frame += 1) motion.step(1 / 60)
    expect(motion.currentRect.width).toBeCloseTo(84, 0)
    expect(motion.currentRect.height).toBeCloseTo(52, 0)
  })

  it('builds a rounded liquid contour from multiple smooth segments per corner', () => {
    const path = createLiquidNavigationPath({
      rect: rect(0, 0, 64, 44),
      radius: 22,
      direction: { x: 1, y: 0 },
      energy: 0.6,
    })

    expect((path.match(/C/g) ?? []).length).toBeGreaterThanOrEqual(
      NAV_LIQUID_MOTION.deformation.cornerSegments * 4,
    )
    expect(path).toMatch(/^M /)
    expect(path).toMatch(/ Z$/)
  })

  it('keeps reduced motion clean and stabilizes after a long dropped frame', () => {
    const motion = new LiquidNavigationMotion()
    motion.retarget(rect(0), 'off')
    motion.retarget(rect(180), 'reduced')

    const reducedFrame = motion.step(1 / 60, 'reduced')
    expect(reducedFrame.energy).toBe(0)
    expect(reducedFrame.trailOpacity).toBe(0)

    const recoveredFrame = motion.step(1, 'full')
    expect(Number.isFinite(recoveredFrame.rect.left)).toBe(true)
    expect(Number.isFinite(recoveredFrame.rect.width)).toBe(true)
  })
})
