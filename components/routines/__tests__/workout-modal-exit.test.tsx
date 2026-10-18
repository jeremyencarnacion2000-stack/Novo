import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ActiveWorkoutSession } from '@/components/routines/active-workout-session'

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'modal-test' } }, status: 'authenticated' }) }))
afterEach(() => { cleanup(); delete document.documentElement.dataset.novoMotion })

it('notifies cancellation after Escape even when the liquid return is immediate', async () => {
  document.documentElement.dataset.novoMotion = 'off'
  const onCancel = jest.fn()
  const routine = { id: 'routine-test', name: 'Fuerza', days: [{ id: 'day-test', name: 'Lunes', exercises: [] }] } as any
  render(<ActiveWorkoutSession routine={routine} onComplete={jest.fn()} onCancel={onCancel} />)
  const dialog = await screen.findByRole('dialog')
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
})
