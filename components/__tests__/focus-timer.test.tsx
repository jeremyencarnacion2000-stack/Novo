import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusTimerWidget } from '../focus-timer-widget'
import { FocusProvider, useFocus } from '@/lib/focus-context'

// FocusProvider calls useSession(); provide an authenticated session so it
// renders without a real <SessionProvider> wrapper.
jest.mock('next-auth/react', () => ({
    useSession: () => ({ data: { user: { id: 'test-user' } }, status: 'authenticated' }),
}))

// Mock the audio
window.HTMLMediaElement.prototype.play = jest.fn()

const TestComponent = () => {
    const { toggleTimer } = useFocus()
    return (
        <div>
            <button onClick={() => toggleTimer()}>Activate</button>
            <FocusTimerWidget />
        </div>
    )
}

describe('FocusTimerWidget', () => {
    it('activates and displays initial time', () => {
        render(
            <FocusProvider>
                <TestComponent />
            </FocusProvider>
        )

        // Initially not visible
        expect(screen.queryByText('25:00')).not.toBeInTheDocument()

        // Activate
        fireEvent.click(screen.getByText('Activate'))

        // Now visible
        expect(screen.getByText('25:00')).toBeInTheDocument()
    })

    it('toggles timer on click', () => {
        render(
            <FocusProvider>
                <TestComponent />
            </FocusProvider>
        )
        // Activate → widget mounts and shows the initial time.
        fireEvent.click(screen.getByText('Activate'))
        expect(screen.getByText('25:00')).toBeInTheDocument()

        // Buttons: [0] "Activate" (test harness), [1] toggle (Pause/Play), [2] reset.
        // The widget's toggle flips the active state; the widget only renders while
        // active, so toggling it off hides the timer again.
        const toggleButton = screen.getAllByRole('button')[1]
        fireEvent.click(toggleButton)

        expect(screen.queryByText('25:00')).not.toBeInTheDocument()
    })
})
