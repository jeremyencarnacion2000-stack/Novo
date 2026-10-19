import { createLiquidModalMotion, getLiquidModalOverlay } from '@/lib/liquid-modal-motion'

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) })

describe('liquid modal lifecycle', () => {
  let frames: Map<number, FrameRequestCallback>
  let now: number
  let serial: number
  const step = (count = 100) => {
    for (let i = 0; i < count; i++) {
      now += 16
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(now))
    }
  }
  const fixture = () => {
    const source = document.createElement('button')
    source.style.opacity = '0.8'
    source.getBoundingClientRect = () => rect(30, 60, 80, 44)
    const surface = document.createElement('section')
    surface.getBoundingClientRect = () => rect(200, 160, 400, 350)
    const overlay = document.createElement('div')
    document.body.append(source, overlay, surface)
    return { source, surface, overlay }
  }
  beforeEach(() => {
    frames = new Map(); now = 0; serial = 0
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++serial, callback); return serial })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
    document.documentElement.dataset.novoMotion = 'full'
  })
  afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML = ''; delete document.documentElement.dataset.novoMotion })

  it('survives open → close → reopen without stale callbacks or decorative leaks', () => {
    const { source, surface, overlay } = fixture()
    const driver = createLiquidModalMotion({ surface, overlay, origin: source })
    driver.open(); step(5)
    const staleClose = jest.fn()
    driver.close(staleClose); step(3); driver.open(); step()
    expect(staleClose).not.toHaveBeenCalled()
    expect(surface.dataset.modalMotionState).toBe('open')
    expect(surface.style.opacity).toBe('1')
    expect(document.querySelector('[data-liquid-modal-bridge]')).toBeNull()
    const close = jest.fn()
    driver.close(close); step()
    expect(close).toHaveBeenCalledTimes(1)
    expect(source.style.opacity).toBe('0.8')
    expect(document.querySelector('[data-liquid-modal-bridge]')).toBeNull()
    driver.destroy()
    expect(frames.size).toBe(0)
  })

  it('completes an immediate close and cancels every frame on unmount', () => {
    const { surface } = fixture()
    const driver = createLiquidModalMotion({ surface })
    const done = jest.fn()
    driver.close(done)
    expect(done).toHaveBeenCalledTimes(1)
    driver.open(); step(3); driver.destroy()
    expect(frames.size).toBe(0)
    expect(surface.style.opacity).toBe('1')
    expect(document.querySelector('[data-liquid-modal-bridge]')).toBeNull()
  })

  it.each(['off', 'reduced'])('keeps %s mode free of travel and goo', (mode) => {
    document.documentElement.dataset.novoMotion = mode
    const { surface, source } = fixture()
    const driver = createLiquidModalMotion({ surface, origin: source })
    driver.open(); step()
    expect(surface.style.opacity).toBe('1')
    expect(surface.style.transform).toBe('')
    expect(document.querySelector('[data-liquid-modal-bridge]')).toBeNull()
    const done = jest.fn(); driver.close(done); step()
    expect(done).toHaveBeenCalledTimes(1)
    driver.destroy()
  })

  it('settles a running transition immediately when motion is switched off', async () => {
    const { surface, overlay } = fixture()
    const driver = createLiquidModalMotion({ surface, overlay })
    expect(getLiquidModalOverlay(surface)).toBe(overlay)
    driver.open(); step(4)
    document.documentElement.dataset.novoMotion = 'off'
    await Promise.resolve()
    expect(surface.dataset.modalMotionState).toBe('open')
    expect(frames.size).toBe(0)
    const done = jest.fn(); driver.close(done)
    expect(done).toHaveBeenCalledTimes(1)
    driver.destroy()
    expect(getLiquidModalOverlay(surface)).toBeNull()
  })
})
