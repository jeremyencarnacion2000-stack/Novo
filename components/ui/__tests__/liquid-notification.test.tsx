import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { LiquidNotification } from '@/components/ui/liquid-notification'
import { motionValue } from 'framer-motion'

let mode = 'full'
const flights: Array<{ target: number; options: any; finish: () => void; stopped: boolean }> = []
jest.mock('@/hooks/use-novo-motion-policy', () => ({ useNovoMotionPolicy: () => mode }))
jest.mock('framer-motion', () => {
  const real = jest.requireActual('framer-motion')
  return { ...real, animate: (value: any, target: number, options: any) => {
    let done = () => {}
    const flight = { target, options, stopped: false, finish: () => { if (!flight.stopped) { value.set(target); done() } } }
    flights.push(flight)
    return { stop: () => { flight.stopped = true }, then: (callback: () => void) => { done = callback } }
  } }
})

describe('liquid notice presence', () => {
  const source = document.createElement('button')
  const sourceRef = { current: source }
  beforeEach(() => {
    mode = 'full'; flights.length = 0
    jest.spyOn(source, 'getBoundingClientRect').mockReturnValue({ left: 900, top: 16, right: 936, bottom: 52, width: 36, height: 36 } as DOMRect)
  })
  afterEach(() => jest.restoreAllMocks())
  const notice = (id: string | null) => <LiquidNotification noticeKey={id} sourceRef={sourceRef} onDismiss={() => {}}><p>{id}</p></LiquidNotification>

  it('retains the current content through its return before presenting the next notice', () => {
    const { rerender } = render(notice('Primero'))
    expect(flights.map(flight => flight.options.delay ?? 0)).toEqual([0, 0.34, 0.56])
    act(() => flights.forEach(flight => flight.finish()))
    rerender(notice('Segundo'))
    expect(screen.getByText('Primero')).toBeInTheDocument()
    expect(screen.queryByText('Segundo')).not.toBeInTheDocument()
    expect(document.querySelector('[data-liquid-notice]')).toHaveAttribute('inert')
    act(() => flights.at(-1)!.finish())
    expect(screen.getByText('Segundo')).toBeInTheDocument()
    rerender(notice(null))
    act(() => flights.at(-1)!.finish())
    expect(document.querySelector('[data-liquid-notice]')).not.toBeInTheDocument()
  })

  it('replaces an in-flight notice without resetting any active animation to a stale starting value', () => {
    const { rerender } = render(notice('A'))
    const opening = [...flights]
    rerender(notice(null))
    expect(opening.every(flight => flight.stopped)).toBe(true)
    rerender(notice('A'))
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(document.querySelector('[data-liquid-notice]')).not.toHaveAttribute('inert')
    expect(flights.at(-1)!.target).toBe(1)
  })

  it('uses only a short fade in reduced mode and clears on completion', () => {
    mode = 'reduced'
    const { rerender } = render(notice('Accesible'))
    expect(flights).toHaveLength(1)
    expect(flights[0].options).toEqual({ duration: 0.16 })
    act(() => flights[0].finish())
    expect(document.querySelector('svg')).toHaveStyle({ visibility: 'hidden' })
    rerender(notice(null))
    act(() => flights.at(-1)!.finish())
    expect(screen.queryByText('Accesible')).not.toBeInTheDocument()
  })

  it('follows the Hub position while preserving native vertical content scrolling', () => {
    const y = motionValue(80)
    render(<LiquidNotification noticeKey="follow" sourceRef={sourceRef} sourcePosition={y} onDismiss={() => {}}><p>Contenido largo</p></LiquidNotification>)
    const card = document.querySelector<HTMLElement>('[data-liquid-notice]')!
    expect(card.style.top).toBe('150px')
    act(() => y.set(180))
    expect(card.style.top).toBe('250px')
    act(() => flights.forEach(flight => flight.finish()))
    expect((screen.getByRole('status') as HTMLElement).style.touchAction).toBe('pan-y')
  })
})
