import { render, screen } from '@testing-library/react'
import { WelcomeCarousel } from './welcome-screen'

describe('WelcomeCarousel truthfulness', () => {
  it('does not promise biometric measurement in the first-use experience', () => {
    render(<WelcomeCarousel />)
    expect(screen.queryByText(/biometric/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Your real schedule and commitments/i)).toBeInTheDocument()
    expect(screen.getByText(/A useful first day, not an empty dashboard/i)).toBeInTheDocument()
  })
})
