import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button ripple microinteraction', () => {
  const matchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = matchMedia
    delete document.documentElement.dataset.novoMotion
  })

  it('creates a localized ripple for a primary pointer press', async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia

    const onPointerDown = jest.fn()
    render(<Button ripple onPointerDown={onPointerDown}>Capture</Button>)
    const button = screen.getByRole('button', { name: 'Capture' })

    fireEvent.pointerDown(button, { button: 0, clientX: 12, clientY: 8 })

    expect(onPointerDown).toHaveBeenCalled()
    await waitFor(() => expect(button.querySelector('[aria-hidden="true"]')).toBeInTheDocument())
  })

  it('does not animate when reduced motion is enabled', () => {
    // Novo owns the desktop policy. The component reads the resolved app mode,
    // not the host OS media query directly.
    document.documentElement.dataset.novoMotion = 'reduced'

    render(<Button ripple>Capture</Button>)
    const button = screen.getByRole('button', { name: 'Capture' })

    fireEvent.pointerDown(button, { button: 0, clientX: 12, clientY: 8 })

    expect(button.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument()
  })
})
