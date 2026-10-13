import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PomodoroWidget } from '@/components/pomodoro-widget'
import { FocusProvider, useFocus } from '@/lib/focus-context'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'pomodoro-widget-test' } }, status: 'authenticated' }),
}))

jest.mock('@/components/ui/GlassSurface', () => {
  const React = require('react')
  return {
    GlassSurface: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  }
})

function SelectTestTask() {
  const { addTask, setSelectedTaskId } = useFocus()

  return (
    <button type="button" onClick={() => {
      addTask('Unir Hub y temporizador', 'hub-task')
      setSelectedTaskId('hub-task')
    }}>
      Seleccionar tarea de prueba
    </button>
  )
}

describe('PomodoroWidget', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as unknown as typeof fetch
  })

  it('keeps the detached view open when pausing or resetting; only its close action returns to the Hub', () => {
    const onClose = jest.fn()

    render(
      <FocusProvider>
        <PomodoroWidget open animating={false} onClose={onClose} />
      </FocusProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar temporizador' }))
    expect(screen.getByRole('button', { name: 'Pausar temporizador' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar temporizador' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar temporizador' }))
    expect(screen.getByRole('button', { name: 'Continuar temporizador' })).toBeInTheDocument()
    expect(screen.getByText('25:00')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Pomodoro y volver al Hub' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the selected focus task and exposes interval progress to assistive technology', () => {
    render(
      <FocusProvider>
        <SelectTestTask />
        <PomodoroWidget open animating={false} onClose={jest.fn()} />
      </FocusProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar tarea de prueba' }))

    expect(screen.getByText('Unir Hub y temporizador')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progreso del intervalo' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('announces timer state changes without turning the ticking countdown into a live region', () => {
    render(
      <FocusProvider>
        <PomodoroWidget open animating={false} onClose={jest.fn()} />
      </FocusProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar temporizador' }))

    expect(screen.getByRole('status')).toHaveTextContent('Temporizador en marcha · Trabajo')
    expect(screen.getByText('25:00')).not.toHaveAttribute('aria-live')
  })
})
