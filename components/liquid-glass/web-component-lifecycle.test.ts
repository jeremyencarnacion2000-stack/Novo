import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ObserverRecord = {
  targets: Element[]
  disconnect: jest.Mock
}

const observers: ObserverRecord[] = []
const animationFrames: FrameRequestCallback[] = []

class TestMutationObserver {
  private readonly record: ObserverRecord

  constructor(_callback: MutationCallback) {
    this.record = { targets: [], disconnect: jest.fn() }
    observers.push(this.record)
  }

  observe(target: Node) {
    if (target instanceof Element) this.record.targets.push(target)
  }

  disconnect() {
    this.record.disconnect()
  }
}

class TestResizeObserver {
  private readonly record: ObserverRecord

  constructor(_callback: ResizeObserverCallback) {
    this.record = { targets: [], disconnect: jest.fn() }
    observers.push(this.record)
  }

  observe(target: Element) {
    this.record.targets.push(target)
  }

  disconnect() {
    this.record.disconnect()
  }
}

describe('supplied Liquid Glass web component lifecycle', () => {
  let addDocumentListener: jest.SpyInstance
  let removeDocumentListener: jest.SpyInstance
  let addWindowListener: jest.SpyInstance
  let removeWindowListener: jest.SpyInstance

  beforeAll(() => {
    Object.assign(window, {
      DisplacementUtils: {
        getDisplacementFilter: jest.fn(() => 'url(#mock-filter)'),
        getDisplacementMap: jest.fn(() => 'data:image/svg+xml,mock'),
      },
      MutationObserver: TestMutationObserver,
      ResizeObserver: TestResizeObserver,
    })
    Object.assign(globalThis, {
      MutationObserver: TestMutationObserver,
      ResizeObserver: TestResizeObserver,
    })
    const requestFrame = (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    }
    Object.assign(window, { requestAnimationFrame: requestFrame })
    Object.assign(globalThis, { requestAnimationFrame: requestFrame })

    const readScript = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
    new Function(readScript('public/liquid-glass/glass-element.js'))()
    new Function(readScript('public/liquid-glass/video-variant.js'))()
  })

  beforeEach(() => {
    observers.length = 0
    animationFrames.length = 0
    addDocumentListener = jest.spyOn(document, 'addEventListener')
    removeDocumentListener = jest.spyOn(document, 'removeEventListener')
    addWindowListener = jest.spyOn(window, 'addEventListener')
    removeWindowListener = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    document.body.replaceChildren()
    jest.restoreAllMocks()
  })

  it('disconnects per-lens observers and global listeners on unmount', async () => {
    await customElements.whenDefined('glass-element')
    const lens = document.createElement('glass-element')
    lens.setAttribute('auto-size', '')
    lens.setAttribute('responsive', '')
    document.body.append(lens)

    const mouseUp = addDocumentListener.mock.calls.find(([type]) => type === 'mouseup')?.[1]
    const resize = addWindowListener.mock.calls.find(([type]) => type === 'resize')?.[1]
    expect(mouseUp).toBeDefined()
    expect(resize).toBeDefined()

    lens.remove()

    expect(removeDocumentListener).toHaveBeenCalledWith('mouseup', mouseUp)
    expect(removeWindowListener).toHaveBeenCalledWith('resize', resize)
    expect(observers).toHaveLength(2)
    expect(observers.every(({ disconnect }) => disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('does not keep requesting animation frames for a zero-sized auto-size lens', async () => {
    await customElements.whenDefined('glass-element')
    const lens = document.createElement('glass-element')
    lens.setAttribute('auto-size', '')
    document.body.append(lens)
    const glassBox = lens.shadowRoot?.querySelector('.glass-box')
    expect(glassBox).not.toBeNull()
    glassBox!.getBoundingClientRect = () => ({
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    })

    await Promise.resolve()
    let framesRun = 0
    while (animationFrames.length > 0 && framesRun < 8) {
      animationFrames.shift()?.(framesRun * 16)
      framesRun += 1
    }

    expect(framesRun).toBeLessThan(8)
    expect(animationFrames).toHaveLength(0)
    lens.remove()
  })

  it('updates optical attributes without rebuilding the stable shadow surface', async () => {
    await customElements.whenDefined('glass-element')
    const lens = document.createElement('glass-element')
    document.body.append(lens)
    const initialSurface = lens.shadowRoot?.querySelector('.glass-box')
    lens.setAttribute('width', '240')
    lens.setAttribute('chromatic-aberration', '15')
    await Promise.resolve()

    expect(lens.shadowRoot?.querySelector('.glass-box')).toBe(initialSurface)
    lens.remove()
  })

  it('enhances existing and future elements without observing the whole document', async () => {
    await customElements.whenDefined('glass-element')
    await Promise.resolve()
    const future = document.createElement('glass-element')
    document.body.append(future)
    future.dispatchEvent(new CustomEvent('novo:glass-connected', { bubbles: true }))

    expect(future.dataset.videoVariantReady).toBe('1')
    expect(observers.some(({ targets }) => targets.includes(document.documentElement))).toBe(false)

    future.dispatchEvent(new CustomEvent('novo:glass-disconnected', { bubbles: true }))
    expect(future.dataset.videoVariantReady).toBeUndefined()
    future.remove()
  })
})
