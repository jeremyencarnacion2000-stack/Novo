import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

const SessionIntentProbe = () => {
    const { toggleTimer, skipTimer } = useFocus()
    return (
        <div>
            <button onClick={toggleTimer}>Start session</button>
            <button onClick={skipTimer}>Complete session</button>
        </div>
    )
}

describe('FocusTimerWidget', () => {
    beforeEach(() => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as unknown as typeof fetch
    })
    afterEach(() => {
        jest.useRealTimers()
    })

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

    it('allocates a new idempotency key for each completed session', () => {
        jest.useFakeTimers()
        render(
            <FocusProvider>
                <SessionIntentProbe />
            </FocusProvider>
        )

        fireEvent.click(screen.getByText('Start session'))
        act(() => { jest.advanceTimersByTime(60_000) })
        fireEvent.click(screen.getByText('Complete session'))
        fireEvent.click(screen.getByText('Start session'))
        act(() => { jest.advanceTimersByTime(60_000) })
        fireEvent.click(screen.getByText('Complete session'))

        const finishedRequests = (global.fetch as jest.Mock).mock.calls.filter(([, options]) => {
            const body = typeof options?.body === 'string' ? JSON.parse(options.body) : null
            return body?.event === 'finished'
        })
        expect(finishedRequests).toHaveLength(2)
        const keys = finishedRequests.map(([, options]) => options.headers['Idempotency-Key'])
        expect(keys[0]).toBeTruthy()
        expect(keys[1]).toBeTruthy()
        expect(keys[0]).not.toBe(keys[1])
    })
})
