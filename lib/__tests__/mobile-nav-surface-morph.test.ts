import { gsap } from 'gsap'
import { criticalSpring } from '@/hooks/use-shared-surface-morph'
import { withSharedSurfaceBounce } from '@/lib/modal-motion'
import { modalFlip } from '@/lib/modal-flip'

type TimelineDouble = {
  options: gsap.TimelineVars
  tweens: Array<{ target: gsap.TweenTarget; vars: gsap.TweenVars }>
  to: jest.Mock
  eventCallback: jest.Mock
  timeScale: jest.Mock
  play: jest.Mock
  reverse: jest.Mock
  kill: jest.Mock
}

function createTimelineDouble(options: gsap.TimelineVars = {}): TimelineDouble {
  const timeline: TimelineDouble = {
    options,
    tweens: [],
    to: jest.fn((target: gsap.TweenTarget, vars: gsap.TweenVars) => {
      timeline.tweens.push({ target, vars })
      return timeline
    }),
    eventCallback: jest.fn(() => timeline),
    timeScale: jest.fn(() => timeline),
    play: jest.fn(() => timeline),
    reverse: jest.fn(() => timeline),
    kill: jest.fn(() => timeline),
  }
  return timeline
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

describe('mobile navigation surface morph', () => {
  const timelines: TimelineDouble[] = []
  let timelineSpy: jest.SpyInstance

  beforeEach(() => {
    timelines.length = 0
    document.documentElement.dataset.novoMotion = 'full'
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((media: string) => ({
        matches: false,
        media,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    timelineSpy = jest.spyOn(gsap, 'timeline').mockImplementation(((options?: gsap.TimelineVars) => {
      const timeline = createTimelineDouble(options)
      timelines.push(timeline)
      return timeline as unknown as gsap.core.Timeline
    }) as typeof gsap.timeline)
  })

  afterEach(() => {
    modalFlip.cancel('mobile-nav-panel')
    timelineSpy.mockRestore()
    document.body.replaceChildren()
    delete document.documentElement.dataset.novoMotion
  })

  it('morphs the real dialog surface from the rail without creating a second glass bridge', () => {
    const origin = document.createElement('div')
    origin.dataset.flipFrom = 'mobile-nav-panel'
    origin.style.borderRadius = '9999px'
    origin.getBoundingClientRect = () => rect(16, 700, 360, 56)
    const originClose = document.createElement('button')
    originClose.dataset.sharedItem = 'mobile-nav-close'
    originClose.getBoundingClientRect = () => rect(320, 706, 48, 44)
    origin.append(originClose)

    const target = document.createElement('section')
    target.dataset.flipTo = 'mobile-nav-panel'
    target.dataset.modalMotionState = 'preparing'
    target.style.borderRadius = '32px'
    target.getBoundingClientRect = () => rect(16, 400, 360, 356)
    const targetClose = document.createElement('button')
    targetClose.dataset.sharedItem = 'mobile-nav-close'
    targetClose.dataset.slot = 'dialog-close'
    targetClose.getBoundingClientRect = () => rect(320, 408, 40, 40)
    const contentRoot = document.createElement('div')
    contentRoot.dataset.modalContent = ''
    contentRoot.append(document.createElement('span'))
    target.append(targetClose, contentRoot)
    document.body.append(origin, target)

    modalFlip.toggle('mobile-nav-panel')

    const bridge = document.querySelector<HTMLElement>('[data-modal-motion-bridge]')
    expect(bridge).toBeNull()
    const openingTimeline = timelines[0]
    const openingMorph = openingTimeline.tweens.find(({ target: tweenTarget, vars }) =>
      tweenTarget === target && typeof vars.clipPath === 'string' && vars.duration === 0.59,
    )
    expect(openingMorph).toBeDefined()
    expect(openingMorph?.vars.clipPath).toContain('inset(0px 0px 0px 0px')
    expect((openingMorph?.vars.ease as (progress: number) => number)(0.5)).toBeCloseTo(
      withSharedSurfaceBounce(criticalSpring(7.35))(0.5),
      8,
    )
    expect((openingMorph?.vars.ease as (progress: number) => number)(0.8)).toBeGreaterThan(1)
    const flyingClose = document.querySelector<HTMLElement>('[data-flying-clone]')
    expect(flyingClose).not.toBeNull()
    expect(openingTimeline.to).toHaveBeenCalledWith(
      flyingClose,
      expect.objectContaining({ rotation: 45 }),
      0.006,
    )
    expect(target.style.clipPath).toContain('inset(')
    expect(target.style.opacity).toBe('1')
    expect(origin.style.opacity).toBe('0')
    expect(openingTimeline.to).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ opacity: 1, y: 0, duration: 0.22 }),
      0.21,
    )
  })

  it('returns the dialog surface to the rail and restores the original navigation surface', () => {
    const origin = document.createElement('div')
    origin.dataset.flipFrom = 'mobile-nav-panel'
    origin.style.borderRadius = '9999px'
    origin.getBoundingClientRect = () => rect(16, 700, 360, 56)
    const originClose = document.createElement('button')
    originClose.dataset.sharedItem = 'mobile-nav-close'
    origin.append(originClose)
    const target = document.createElement('section')
    target.dataset.flipTo = 'mobile-nav-panel'
    target.dataset.modalMotionState = 'open'
    target.style.borderRadius = '32px'
    target.getBoundingClientRect = () => rect(16, 400, 360, 356)
    const targetClose = document.createElement('button')
    targetClose.dataset.sharedItem = 'mobile-nav-close'
    targetClose.dataset.slot = 'dialog-close'
    const contentRoot = document.createElement('div')
    contentRoot.dataset.modalContent = ''
    contentRoot.append(document.createElement('span'))
    target.append(targetClose, contentRoot)
    document.body.append(origin, target)

    modalFlip.toggle('mobile-nav-panel')
    const openingTimeline = timelines[0]
    openingTimeline.options.onComplete?.()

    modalFlip.untoggle('mobile-nav-panel')
    const closingTimeline = timelines[1]
    const flyingClose = document.querySelector<HTMLElement>('[data-flying-clone]')
    expect(flyingClose).not.toBeNull()
    expect(closingTimeline.to).toHaveBeenCalledWith(
      flyingClose,
      expect.objectContaining({ rotation: -45 }),
      0.006,
    )
    expect(closingTimeline.tweens.some(({ target: tweenTarget, vars }) =>
      tweenTarget === target && typeof vars.clipPath === 'string' && vars.duration === 0.52,
    )).toBe(true)
    expect(document.querySelector('[data-modal-motion-bridge]')).toBeNull()
    expect(origin.style.opacity).toBe('0')
    closingTimeline.options.onComplete?.()
    expect(origin.style.opacity).toBe('')
    expect(target.style.opacity).toBe('0')
  })
})
