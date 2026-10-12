import React from 'react'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../error-boundary'

describe('ErrorBoundary', () => {
  it('shows a stable recovery message instead of leaking the error payload', () => {
    const originalError = console.error
    console.error = jest.fn()

    function Broken(): React.ReactNode {
      throw new Error('provider secret: should never reach the UI')
    }

    try {
      render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      )

      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
      expect(screen.queryByText(/provider secret/)).not.toBeInTheDocument()
    } finally {
      console.error = originalError
    }
  })
})
