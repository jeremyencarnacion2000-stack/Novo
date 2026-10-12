/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NovoThinkingPill } from '@/components/ai/novo-thinking-pill'

let mockLanguage = 'es'

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ language: mockLanguage, t: (key: string) => key }),
}))

jest.mock('@/hooks/use-novo-motion-policy', () => ({
  useNovoMotionPolicy: () => 'full',
}))

jest.mock('@/lib/liquid-glass/useLiquidGlass', () => ({
  useLiquidGlass: () => ({
    ref: { current: null }, mapUrl: '', width: 360, height: 72,
    hasSVGFilterSupport: false, useSVGFilter: false, filterUrl: '',
    buildBackdropFilter: () => '',
  }),
}))

class MockEventSource {
  static instances: MockEventSource[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = jest.fn()

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this)
  }
}

describe('NovoThinkingPill', () => {
  const originalEventSource = global.EventSource

  beforeEach(() => {
    MockEventSource.instances = []
    mockLanguage = 'es'
    global.EventSource = MockEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    global.EventSource = originalEventSource
    jest.restoreAllMocks()
  })

  it('maps real activity phases into the visible Twin state', async () => {
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({
        data: JSON.stringify({
          type: 'activity',
          event: { runId: 'run-1', sequence: 1, phase: 'retrieving_context', label: 'Gmail y GitHub', timestamp: new Date().toISOString() },
        }),
      } as MessageEvent)
    })

    expect(screen.getByText('Buscando contexto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscando contexto' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands the same accessible surface and keeps out-of-order events sorted', async () => {
    const user = userEvent.setup()
    render(<NovoThinkingPill runId="run-1" modelLabel="Cognitive Core" intent="TASK" fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-1', sequence: 2, phase: 'planning', label: 'Preparando acción', timestamp: new Date().toISOString() } }) } as MessageEvent)
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-1', sequence: 1, phase: 'retrieving_context', label: 'Recuperando contexto', timestamp: new Date().toISOString() } }) } as MessageEvent)
    })

    await user.click(screen.getByRole('button', { name: 'Planificando' }))
    expect(screen.getByRole('button', { name: 'Planificando' })).toHaveAttribute('aria-expanded', 'true')
    const timeline = screen.getByRole('list')
    expect(timeline.textContent!.indexOf('Buscando contexto')).toBeLessThan(timeline.textContent!.indexOf('Planificando'))
    expect(screen.getByText(/Cognitive Core/)).toBeInTheDocument()
  })

  it('localizes known activity phases in the expanded chronology', async () => {
    const user = userEvent.setup()
    mockLanguage = 'fr'
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-1', sequence: 1, phase: 'planning', label: 'Preparando acción', timestamp: new Date().toISOString() } }) } as MessageEvent)
    })

    await user.click(screen.getByRole('button', { name: 'Planification' }))
    expect(screen.getByRole('list')).toHaveTextContent('Planification')
    expect(screen.queryByText('Preparando acción')).not.toBeInTheDocument()
  })

  it('cancels the real activity run from the expanded surface', async () => {
    const user = userEvent.setup()
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ run: { id: 'run-1', status: 'cancelled', sequence: 1, phase: 'cancelled' } }),
    } as Response)
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await user.click(screen.getByRole('button', { name: 'Pensando' }))
    await user.click(screen.getByRole('button', { name: 'Detener ejecución' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/activity/runs/run-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ejecución detenida' })).toBeInTheDocument())
  })

  it('offers reconnection after SSE recovery fails', async () => {
    const user = userEvent.setup()
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onerror?.()
      await Promise.resolve()
    })

    await user.click(screen.getByRole('button', { name: 'Reconectando' }))
    expect(screen.getByRole('button', { name: 'Reintentar conexión' })).toBeInTheDocument()
  })

  it('does not present a terminal SSE close as a reconnecting run', async () => {
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({
        type: 'run',
        run: { id: 'run-1', status: 'completed', sequence: 2, phase: 'completed' },
      }) } as MessageEvent)
      MockEventSource.instances[0].onerror?.()
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reconectando' })).not.toBeInTheDocument()
  })

  it('clears the reconnecting state when the retried stream yields a valid frame', async () => {
    const user = userEvent.setup()
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))
    render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)

    await act(async () => {
      MockEventSource.instances[0].onerror?.()
      await Promise.resolve()
    })
    await user.click(screen.getByRole('button', { name: 'Reconectando' }))
    await user.click(screen.getByRole('button', { name: 'Reintentar conexión' }))
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2))

    await act(async () => {
      MockEventSource.instances[1].onmessage?.({ data: JSON.stringify({
        type: 'activity',
        event: { runId: 'run-1', sequence: 1, phase: 'retrieving_context', label: 'Gmail', timestamp: new Date().toISOString() },
      }) } as MessageEvent)
    })

    expect(screen.getByRole('button', { name: 'Buscando contexto' })).toBeInTheDocument()
  })

  it('pauses the living pill fields once the surface leaves the viewport', async () => {
    const originalIntersectionObserver = global.IntersectionObserver
    let observerCallback: IntersectionObserverCallback | undefined
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return [] }
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = []
    }
    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

    const { container } = render(<NovoThinkingPill runId="run-1" modelLabel={null} intent={null} fallback={false} />)
    const fields = container.querySelector('.novo-thinking-pill__fields')
    expect(fields).toHaveAttribute('data-active', 'true')

    await act(async () => {
      observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(fields).toHaveAttribute('data-active', 'false')
    global.IntersectionObserver = originalIntersectionObserver
  })
})
