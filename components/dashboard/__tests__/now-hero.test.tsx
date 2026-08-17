import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { NowHero } from '../now-hero'

// SWR's cache is a module-level global by default - without a fresh
// provider per test, dedupingInterval (5s, see hooks/use-swr.ts) means a
// later test's /api/ai/cognitive-engine mock is silently ignored in favor
// of whatever an earlier test in this file already cached for that key.
const renderNowHero = () => render(
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <NowHero />
  </SWRConfig>
)

jest.mock('@/lib/cognitive-twin-context', () => ({
  useCognitiveTwin: () => ({
    twin: {
      energyCurve: { chronotype: 'morning_lark', peakFocusStart: '07:00', peakFocusEnd: '10:00' },
      bottlenecks: { mainFrictionPoint: 'procrastination' },
    },
  }),
}))

jest.mock('@/lib/cognitive-context', () => ({
  useCognitivePhase: () => 'LINEAR_EXECUTION',
}))

describe('NowHero calendar override', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('uses the original Ahora gradient instead of the global premium material', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    const { container } = renderNowHero()

    await waitFor(() => expect(container.querySelector('.bg-gradient-to-br')).not.toBeNull())
    expect(container.querySelector('.novo-premium-field')).toBeNull()
  })

  it('shows a calendar signal headline when no urgent task exists but a calendar signal was logged today', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Tienes reuniones muy seguidas. Reserva un margen antes de tu siguiente bloque.')).toBeInTheDocument()
    })
  });

  it('prefers an overdue task over a calendar signal', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 't1', title: 'Tarea vencida importante', priority: 'high', dueDate: '2020-01-01' },
          ]),
        });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Tarea vencida importante')).toBeInTheDocument()
    })
  });

  it('uses a pending checklist item when the task endpoint is empty', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/checklist')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'c1', text: 'Preparar la demo', priority: 'high', dueDate: null, completed: false },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ signal: null }) });
    });

    renderNowHero();

    await waitFor(() => {
      expect(screen.getByText('Preparar la demo')).toBeInTheDocument();
    });
  });

  it('prefers a calendar signal over a non-urgent task', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 't1', title: 'Tarea de baja prioridad', priority: 'low', dueDate: null },
          ]),
        });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Tienes reuniones muy seguidas. Reserva un margen antes de tu siguiente bloque.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Tarea de baja prioridad')).not.toBeInTheDocument()
  });

  it('offers a "Reorganizar mi día" action when a calendar disruption signal has a real reorganizedDay from the engine', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_peak_conflict', description: 'Una reunión cae dentro de tu ventana pico.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
      if (url.includes('/api/ai/cognitive-engine')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            report: { reorganizedDay: [{ id: 't1', title: 'Tarea', priority: 'high', scheduledHour: 10, scheduledTime: '10:00', reason: 'x' }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Reorganizar mi día')).toBeInTheDocument()
    })
  });

  it('does not offer to reorganize when the engine has no reorganizedDay for the signal', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'calendar_peak_conflict', description: 'Una reunión cae dentro de tu ventana pico.', createdAt: new Date().toISOString(), platform: 'calendar' },
          }),
        });
      }
      if (url.includes('/api/ai/cognitive-engine')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, report: { reorganizedDay: [] } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Una reunión cae dentro de tu ventana de mayor enfoque. Considera mover el trabajo profundo.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Reorganizar mi día')).not.toBeInTheDocument()
  });

  it('never renders a raw signal payload or emojis in the Ahora headline', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/active-signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            signal: { id: '1', changeType: 'switch_context', description: '{switch_context} 🧠', createdAt: new Date().toISOString(), platform: 'notion' },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    renderNowHero()

    await waitFor(() => {
      expect(screen.getByText('Has cambiado de contexto varias veces. Elige una sola tarea para los próximos minutos.')).toBeInTheDocument()
    })
    expect(screen.queryByText('{switch_context} 🧠')).not.toBeInTheDocument()
  });
});
