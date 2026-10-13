import fs from 'node:fs'
import path from 'node:path'
import { LIQUID_MORPH_CONFIG, LiquidMorphSpring } from '@/components/command-center-liquid-morph'

describe('mobile navigation liquid morph', () => {
  let now = 0
  let nextFrameId = 1
  let frames: Map<number, FrameRequestCallback>
  let requestFrameSpy: jest.SpyInstance
  let cancelFrameSpy: jest.SpyInstance
  let performanceSpy: jest.SpyInstance

  const advanceFrames = (durationMs: number, stepMs = 16) => {
    const end = now + durationMs
    while (now < end && frames.size) {
      now = Math.min(end, now + stepMs)
      const active = Array.from(frames.entries())
      frames.clear()
      active.forEach(([, callback]) => callback(now))
    }
  }

  beforeEach(() => {
    now = 0
    nextFrameId = 1
    frames = new Map()
    requestFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      const id = nextFrameId++
      frames.set(id, callback)
      return id
    })
    cancelFrameSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })
    performanceSpy = jest.spyOn(performance, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    frames.clear()
    requestFrameSpy.mockRestore()
    cancelFrameSpy.mockRestore()
    performanceSpy.mockRestore()
  })

  it('uses the calibrated physical response and returns to the compact rail', () => {
    expect(LIQUID_MORPH_CONFIG.spring).toEqual({ openResponse: 0.56, closeResponse: 0.5, damping: 0.9 })
    const settled = jest.fn()
    const spring = new LiquidMorphSpring(jest.fn(), settled)

    spring.setTarget(1)
    advanceFrames(1800)
    expect(spring.value).toBe(1)
    expect(settled).toHaveBeenLastCalledWith(1)

    spring.setTarget(0)
    advanceFrames(1800)
    expect(spring.value).toBe(0)
    expect(settled).toHaveBeenLastCalledWith(0)
    expect(frames.size).toBe(0)
    spring.destroy()
  })

  it('reverses from the current physical state without restarting the spring', () => {
    const spring = new LiquidMorphSpring(jest.fn())
    spring.setTarget(1)
    advanceFrames(160)
    const interrupted = spring.value
    expect(interrupted).toBeGreaterThan(0)
    expect(interrupted).toBeLessThan(1)

    spring.setTarget(0)
    expect(spring.value).toBe(interrupted)
    advanceFrames(1500)
    expect(spring.value).toBe(0)

    spring.setTarget(1)
    expect(spring.value).toBe(0)
    advanceFrames(1500)
    expect(spring.value).toBe(1)
    spring.destroy()
  })

  it('keeps one owner for the navigation material, rail, FAB, and panel geometry', () => {
    const source = (file: string) => fs.readFileSync(path.join(process.cwd(), ...file.split('/')), 'utf8')
    const morph = source('components/command-center-liquid-morph.tsx')
    const drawer = source('components/mobile-section-drawer.tsx')
    const hook = source('hooks/use-shared-dialog-motion.ts')

    expect(morph).toContain('springRef.current?.setTarget(active ? 1 : 0)')
    expect(morph).toContain("if (motionMode === 'full')")
    expect(morph).toContain('springRef.current?.setImmediate(active ? 1 : 0)')
    expect(morph).toContain('panel.style.clipPath = clipPath')
    expect(morph).toContain('fab.style.transform =')
    expect(drawer).toContain('motionId="mobile-nav-panel"')
    // Other shared dialogs retain their existing controller. The nav-specific
    // branches coordinate presence and leave geometry to the liquid spring.
    const openNav = hook.match(/if \(isLiquidNav\) \{([\s\S]*?)\n    \}/)?.[1]
    const closeNav = hook.match(/const close = useCallback[\s\S]*?if \(isLiquidNav\) \{([\s\S]*?)\n    \}/)?.[1]
    expect(openNav).toBeDefined()
    expect(closeNav).toContain('onComplete()')
    expect(openNav).not.toContain('modalFlip.')
    expect(closeNav).not.toContain('modalFlip.')
    expect(morph).not.toContain('gsap.')
  })
})
