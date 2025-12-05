import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FloatingChatbot from '../ai/floating-chatbot'
import { ThemeProvider } from 'next-themes'

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}))

// Mock ai-commands
jest.mock('@/lib/ai-commands', () => ({
    detectIntent: jest.fn(() => ({ intent: 'general_chat', data: {} })),
}))

// Mock fetch for chat API
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: 'Hello from bot' }),
    })
) as jest.Mock

describe('FloatingChatbot', () => {
    it('expands and sends message', async () => {
        const { container } = render(
            <ThemeProvider>
                <FloatingChatbot />
            </ThemeProvider>
        )

        // Find the bubble by class since it doesn't have text/role initially
        // The bubble is the fixed element that is NOT the expanded panel
        const bubble = container.querySelector('.fixed.z-50.rounded-full')
        expect(bubble).toBeInTheDocument()

        if (bubble) fireEvent.click(bubble)

        // Now it should be expanded. Check for input.
        const input = await screen.findByPlaceholderText('Pregunta rápida...')
        expect(input).toBeInTheDocument()

        // Type message
        fireEvent.change(input, { target: { value: 'Hello' } })

        // Send by pressing Enter
        fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

        // Expect message to appear
        await waitFor(() => {
            expect(screen.getByText('Hello')).toBeInTheDocument()
        })

        // Expect bot response
        await waitFor(() => {
            expect(screen.getByText('Hello from bot')).toBeInTheDocument()
        })
    })
})
