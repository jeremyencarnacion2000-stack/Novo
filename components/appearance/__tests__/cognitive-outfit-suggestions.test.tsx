/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import { CognitiveOutfitSuggestions } from '../cognitive-outfit-suggestions'

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

describe('CognitiveOutfitSuggestions', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('shows a retry state when the cognitive endpoint is unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Unauthorized' }) }) as jest.Mock

    render(<CognitiveOutfitSuggestions />)

    expect(await screen.findByText('Cognitive state unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('ignores incomplete provider payloads instead of rendering undefined metrics', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, report: { focusScore: null } }) }) as jest.Mock

    render(<CognitiveOutfitSuggestions />)

    await waitFor(() => expect(screen.getByText('Cognitive state unavailable')).toBeInTheDocument())
    expect(screen.queryByText(/undefined\/100/)).not.toBeInTheDocument()
  })
})
