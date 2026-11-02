import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { gsap } from 'gsap'
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss'

jest.mock('gsap', () => ({ gsap: {
  killTweensOf: jest.fn(), getProperty: jest.fn(() => 0), to: jest.fn(),
  set: jest.fn((target: HTMLElement, values: { y?: number }) => {
    if (values.y !== undefined) target.style.transform = `translateY(${values.y}px)`
  }),
} }))
jest.mock('@/lib/liquid-modal-motion', () => ({ getLiquidModalOverlay: () => null }))

function Gesture({ onDismiss }: { onDismiss: (surface: HTMLElement) => void }) {
  const ref = useDragToDismiss<HTMLDivElement>({ onDismiss })
  return <><div data-modal-drag-overlay /><div ref={ref} data-testid="surface" data-liquid-modal-layer data-modal-motion-state="open">Drag</div></>
}

describe('modal gesture frame work', () => {
  let frames: Map<number, FrameRequestCallback>
  const pointer = (surface: HTMLElement, type: string, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: y })
    fireEvent(surface, event)
  }
  const frame = () => act(() => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(performance.now()))
  })
  const mount = (onDismiss = jest.fn()) => {
    const view = render(<Gesture onDismiss={onDismiss} />)
    const surface = screen.getByTestId('surface')
    surface.setPointerCapture = jest.fn()
    surface.releasePointerCapture = jest.fn()
    const measure = jest.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ height: 400 } as DOMRect)
    return { ...view, surface, measure, onDismiss }
  }
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    frames = new Map()
    let id = 0
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
  })
  afterEach(() => jest.restoreAllMocks())

  it('measures once per gesture and batches a burst into one presented frame', () => {
    const { surface, measure } = mount()
    pointer(surface, 'pointerdown', 0)
    for (let y = 10; y <= 60; y++) pointer(surface, 'pointermove', y)
    expect(gsap.set).not.toHaveBeenCalled()
    expect(frames.size).toBe(1)
    frame()
    expect(measure).toHaveBeenCalledTimes(1)
    expect(gsap.set).toHaveBeenCalledTimes(2)
    expect(surface.style.transform).toBe('translateY(60px)')
  })

  it('presents the final drag before handing the surface to its liquid return', () => {
    const onDismiss = jest.fn((surface: HTMLElement) => expect(surface.style.transform).toBe('translateY(160px)'))
    const { surface } = mount(onDismiss)
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 160)
    pointer(surface, 'pointerup', 160)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('restores instead of dismissing when the operating system cancels a drag', () => {
    const { surface, onDismiss } = mount()
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 160)
    pointer(surface, 'pointercancel', 160)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(gsap.to).toHaveBeenCalledWith(surface, expect.objectContaining({ y: 0 }))
    expect(frames.size).toBe(0)
  })

  it('cancels pending frame work when the modal unmounts', () => {
    const { surface, unmount } = mount()
    pointer(surface, 'pointerdown', 0)
    pointer(surface, 'pointermove', 70)
    unmount()
    expect(frames.size).toBe(0)
    frame()
    expect(gsap.set).not.toHaveBeenCalled()
  })
})
