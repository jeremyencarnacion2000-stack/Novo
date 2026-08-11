import { runAppearanceTransition } from '@/lib/appearance-transition'

describe('runAppearanceTransition', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('uses the browser view transition so theme and wallpaper changes share one visual handoff', () => {
    const startViewTransition = jest.fn((update: () => void) => update())
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    const update = jest.fn()

    runAppearanceTransition(update)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('applies the setting immediately when motion is reduced', () => {
    const startViewTransition = jest.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    window.matchMedia = jest.fn().mockReturnValue({ matches: true })
    const update = jest.fn()

    runAppearanceTransition(update)

    expect(update).toHaveBeenCalledTimes(1)
    expect(startViewTransition).not.toHaveBeenCalled()
  })
})
