import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { NowHero } from '../now-hero'

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

  it('shows a calendar signal headline when no urgent task exists but a calendar signal was logged today', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tasks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString() },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NowHero />)

    await waitFor(() => {
      expect(screen.getByText(/3 reuniones seguidas/i)).toBeInTheDocument()
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
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas.', createdAt: new Date().toISOString() },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NowHero />)

    await waitFor(() => {
      expect(screen.getByText('Tarea vencida importante')).toBeInTheDocument()
    })
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
      if (url.includes('/api/cognitive/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: '1', changeType: 'calendar_meeting_overload', description: '3 reuniones seguidas sin respiro hoy — considera un buffer.', createdAt: new Date().toISOString() },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NowHero />)

    await waitFor(() => {
      expect(screen.getByText(/3 reuniones seguidas/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Tarea de baja prioridad')).not.toBeInTheDocument()
  });
});
