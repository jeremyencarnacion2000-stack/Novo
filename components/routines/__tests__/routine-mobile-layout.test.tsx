import { render, screen } from '@testing-library/react'
import { RoutineCard } from '../routine-card'
import { RoutineDetailDialog } from '../routine-detail-dialog'
import type { Routine } from '@/types/routine'

jest.mock('@/hooks/use-modal-flip', () => ({
  useModalFlip: () => (done: () => void) => done(),
}))

const routine: Routine = {
  id: 'routine-1',
  name: 'Rutina definitiva de hipertrofia estética',
  description: 'Una descripción visible en ambos temas.',
  timeOfDay: 'morning',
  duration: 60,
  isActive: true,
  tasks: [],
  days: [{
    id: 'day-1',
    name: 'Día 1 – Pecho superior • Hombros • Tríceps',
    order: 0,
    exercises: [{
      id: 'exercise-1', name: 'Flexiones con pies elevados + mochila', muscleGroup: 'Pecho',
      sets: 4, reps: '6–12', order: 0,
    }],
  }],
}

describe('routine mobile layout', () => {
  it('keeps day headers and exercise metadata in independent responsive lanes', () => {
    render(<RoutineCard routine={routine} onEdit={jest.fn()} onDelete={jest.fn()} onView={jest.fn()} />)

    expect(screen.getByTestId('routine-day-header')).toHaveClass('min-w-0')
    expect(screen.getByTestId('routine-exercise-preview')).toHaveClass('min-w-0')
    expect(screen.getByTestId('routine-exercise-preview-meta')).toHaveClass('shrink-0')
  })

  it('uses a token-aware, safe-area dialog on mobile instead of a forced black surface', () => {
    render(<RoutineDetailDialog open onClose={jest.fn()} routine={routine} onUpdateProgress={jest.fn()} />)

    const dialog = screen.getByTestId('routine-detail-dialog')
    expect(dialog).toHaveClass('!bg-popover/95')
    expect(dialog).not.toHaveClass('!bg-black/80')
    expect(screen.getByTestId('routine-detail-scroll').firstElementChild).toHaveClass('pb-[calc(1.5rem+env(safe-area-inset-bottom))]')
  })
})
