import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { FocusProvider, useFocus, type TimerProfile } from '@/lib/focus-context'

let mockSession: { data: { user: { id: string } } | null; status: 'authenticated' | 'unauthenticated' | 'loading' } = {
  data: { user: { id: 'user-a' } },
  status: 'authenticated',
}

jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}))

function Probe() {
  const { activeProfileId, profiles } = useFocus()
  return <output data-testid="profile">{activeProfileId}:{profiles.map((profile) => profile.id).join(',')}</output>
}

const userBProfile: TimerProfile = {
  id: 'user-b-profile',
  name: 'User B',
  workDuration: 42,
  shortBreakDuration: 7,
  longBreakDuration: 21,
  pomodorosUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
}

describe('FocusProvider session isolation', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSession = { data: { user: { id: 'user-a' } }, status: 'authenticated' }
  })

  it('hydrates only the active account and never writes legacy global keys', async () => {
    localStorage.setItem('novo-focus-profiles:user:user-b', JSON.stringify([userBProfile]))
    localStorage.setItem('novo-focus-active-profile:user:user-b', userBProfile.id)

    const view = render(
      <FocusProvider>
        <Probe />
      </FocusProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('profile')).toHaveTextContent('pomodoro'))

    mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
    view.rerender(
      <FocusProvider>
        <Probe />
      </FocusProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('profile')).toHaveTextContent('user-b-profile:user-b-profile'))
    expect(localStorage.getItem('novo-focus-profiles')).toBeNull()
    expect(localStorage.getItem('novo-focus-profiles:user:user-a')).not.toBeNull()
  })
})
