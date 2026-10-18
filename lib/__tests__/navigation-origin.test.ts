import { hasRecentNavigation, rememberNavigationOrigin, trackNavigationOrigins } from '@/lib/navigation-origin'

describe('navigation origin capture', () => {
  let stop: () => void
  beforeEach(() => {
    document.documentElement.style.removeProperty('--novo-route-origin')
    stop = trackNavigationOrigins()
  })
  afterEach(() => { stop(); document.body.innerHTML = '' })

  function link(href: string) {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.getBoundingClientRect = () => ({ left: 20, top: 40, width: 40, height: 40 } as DOMRect)
    anchor.addEventListener('click', event => event.preventDefault())
    document.body.appendChild(anchor)
    return anchor
  }

  it('captures ordinary internal links without consuming their click', () => {
    const anchor = link('/calendar')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    const capture = jest.fn((e: MouseEvent) => expect(e.defaultPrevented).toBe(false))
    document.addEventListener('click', capture, true)
    anchor.dispatchEvent(event)
    document.removeEventListener('click', capture, true)
    expect(capture).toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--novo-route-origin')).not.toBe('')
  })

  it.each([
    ['https://example.org/elsewhere', {}],
    ['/auth/signin', {}],
    ['/calendar', { ctrlKey: true }],
    ['/calendar', { metaKey: true }],
    ['/calendar', { button: 1 }],
  ])('ignores non-app navigation %s %j', (href, init) => {
    link(href).dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))
    expect(document.documentElement.style.getPropertyValue('--novo-route-origin')).toBe('')
  })

  it('ignores downloads/new windows and supports programmatic nav buttons', () => {
    const download = link('/calendar')
    download.download = 'report'
    download.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const blank = link('/calendar')
    blank.target = '_blank'
    blank.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.documentElement.style.getPropertyValue('--novo-route-origin')).toBe('')
    rememberNavigationOrigin(blank)
    expect(document.documentElement.style.getPropertyValue('--novo-route-origin')).not.toBe('')
    stop()
    document.documentElement.style.removeProperty('--novo-route-origin')
    link('/projects').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.documentElement.style.getPropertyValue('--novo-route-origin')).toBe('')
  })

  it('limits an unpaired route entry to the intended destination and a recent gesture', () => {
    jest.useFakeTimers()
    rememberNavigationOrigin(document.body, '/cognitive')
    expect(hasRecentNavigation('/cognitive')).toBe(true)
    expect(hasRecentNavigation('/auth/signin')).toBe(false)
    jest.advanceTimersByTime(6001)
    expect(hasRecentNavigation('/cognitive')).toBe(false)
    jest.useRealTimers()
  })
})
