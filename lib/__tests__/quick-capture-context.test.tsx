import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QuickCaptureProvider, useQuickCapture } from '@/lib/quick-capture-context'
import { readModalOrigin, trackModalOrigins } from '@/lib/modal-origin'

let stopTracking: (() => void) | null = null

function QuickCaptureProbe() {
  const capture = useQuickCapture()

  return (
    <>
      <button data-capture-trigger="source" onClick={capture.onOpen}>Open capture</button>
      <output data-testid="capture-origin">{capture.originRef.current?.dataset.captureTrigger ?? 'none'}</output>
      <output data-testid="capture-state">{capture.isOpen ? 'open' : 'closed'}</output>
    </>
  )
}

afterEach(() => {
  stopTracking?.()
  stopTracking = null
  jest.restoreAllMocks()
})

it('retains the click source after the short lived global modal origin expires', () => {
  const now = jest.spyOn(performance, 'now').mockReturnValue(0)
  stopTracking = trackModalOrigins()
  render(<QuickCaptureProvider><QuickCaptureProbe /></QuickCaptureProvider>)

  fireEvent.click(screen.getByRole('button', { name: 'Open capture' }))
  expect(screen.getByTestId('capture-state')).toHaveTextContent('open')
  expect(screen.getByTestId('capture-origin')).toHaveTextContent('source')

  now.mockReturnValue(2_000)
  expect(readModalOrigin().element).toBeNull()
  expect(screen.getByTestId('capture-origin')).toHaveTextContent('source')
})
