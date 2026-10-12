import { createFlyingClone, createTextCrossfadeFlight, isTextFlightElement } from '@/lib/flying-clone'

const rect = (left: number, top: number, width: number, height: number) => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
})

describe('shared modal flying elements', () => {
  it('recognizes typography that must move without glyph scaling', () => {
    const text = document.createElement('span')
    text.textContent = 'Create project'
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement

    expect(isTextFlightElement(text)).toBe(true)
    expect(isTextFlightElement(icon)).toBe(false)
  })

  it('creates two real-size text layers for a translate-only crossfade', () => {
    const origin = document.createElement('span')
    const target = document.createElement('h2')
    origin.textContent = target.textContent = 'Create project'
    origin.getBoundingClientRect = () => rect(24, 32, 92, 20)
    target.getBoundingClientRect = () => rect(180, 120, 164, 34)
    document.body.append(origin, target)

    const flight = createTextCrossfadeFlight(origin, target)

    expect(flight.compact.dataset.flyingTextLayer).toBe('compact')
    expect(flight.expanded.dataset.flyingTextLayer).toBe('expanded')
    expect(flight.compact.style.left).toBe('24px')
    expect(flight.compact.style.top).toBe('32px')
    expect(flight.expanded.style.left).toBe('180px')
    expect(flight.expanded.style.top).toBe('120px')
    expect(flight.expanded.style.opacity).toBe('0')
    expect(flight.nodes).toEqual([flight.compact, flight.expanded])

    flight.nodes.forEach((node) => node.remove())
    origin.remove()
    target.remove()
  })

  it('carries the supplied optical material into a shared-element clone', () => {
    const origin = document.createElement('button')
    origin.textContent = 'Open'
    origin.style.backgroundImage = 'url(/grain.png)'
    origin.style.backdropFilter = 'blur(0.5px) url(#displace)'
    origin.style.border = '1px solid rgba(255,255,255,.5)'
    origin.getBoundingClientRect = () => rect(12, 18, 96, 40)
    document.body.append(origin)

    const clone = createFlyingClone(origin)

    expect(clone.style.backgroundImage).toContain('grain.png')
    expect(clone.style.backdropFilter).toContain('url(#displace)')
    expect(clone.style.border).toContain('1px')

    clone.remove()
    origin.remove()
  })
})
