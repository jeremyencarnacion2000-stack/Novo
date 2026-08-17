/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NovoActivitySurface } from '@/components/ai/novo-activity-surface'

class MockEventSource {
  static instances: MockEventSource[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = jest.fn()

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this)
  }
}

describe('NovoActivitySurface recovery', () => {
  const originalEventSource = global.EventSource

  beforeEach(() => {
    MockEventSource.instances = []
    global.EventSource = MockEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    global.EventSource = originalEventSource
    jest.restoreAllMocks()
  })

  it('falls back to the owner-scoped polling endpoint after SSE failure', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        run: { id: 'run-1', status: 'completed', sequence: 2, phase: 'completed' },
        events: [
          { runId: 'run-1', sequence: 1, phase: 'planning', label: 'Preparando', timestamp: new Date().toISOString() },
          { runId: 'run-1', sequence: 2, phase: 'completed', label: 'Plan listo', timestamp: new Date().toISOString(), terminal: true },
        ],
      }),
    } as Response)

    const view = render(<NovoActivitySurface runId="run-1" />)
    expect(MockEventSource.instances).toHaveLength(1)

    await act(async () => {
      MockEventSource.instances[0].onerror?.()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/activity/runs/run-1?after=0', { cache: 'no-store' })
    expect(view.getByText('Plan listo')).toBeTruthy()
    view.unmount()
  })

  it('retries the activity connection without reloading the page', async () => {
    const user = userEvent.setup()
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))
    render(<NovoActivitySurface runId="run-1" />)

    await act(async () => {
      MockEventSource.instances[0].onerror?.()
      await Promise.resolve()
    })

    await user.click(screen.getByRole('button', { name: 'Reintentar conexión' }))
    expect(MockEventSource.instances).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/activity/runs/run-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'telemetry', event: 'retry' }),
    })
  })

  it('keeps an out-of-order event in a sequence-sorted timeline', async () => {
    const user = userEvent.setup()
    render(<NovoActivitySurface runId="run-1" />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-1', sequence: 2, phase: 'planning', label: 'Preparando acción', timestamp: new Date().toISOString() } }) } as MessageEvent)
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-1', sequence: 1, phase: 'retrieving_context', label: 'Recuperando contexto', timestamp: new Date().toISOString() } }) } as MessageEvent)
    })

    await user.click(screen.getByRole('button', { name: 'Detalles' }))
    const timeline = screen.getByRole('list')
    expect(timeline.textContent).toContain('Recuperando contexto')
    expect(timeline.textContent!.indexOf('Recuperando contexto')).toBeLessThan(timeline.textContent!.indexOf('Preparando acción'))
  })

  it('renders the Twin adaptation stage from a real activity event', async () => {
    const user = userEvent.setup()
    render(<NovoActivitySurface runId="run-twin" />)

    await act(async () => {
      MockEventSource.instances[0].onmessage?.({ data: JSON.stringify({ type: 'activity', event: { runId: 'run-twin', sequence: 1, phase: 'adapting', label: 'Subagente de adaptaciÃ³n', timestamp: new Date().toISOString() } }) } as MessageEvent)
    })

    expect(screen.getByText('Adaptando el siguiente comportamiento')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Detalles' }))
    expect(screen.getByRole('list').textContent).toContain('Subagente de adaptaciÃ³n')
  })
})
