import { render, screen } from '@testing-library/react'
import { WelcomeCarousel } from './welcome-screen'

describe('WelcomeCarousel truthfulness', () => {
  it('does not promise biometric measurement in the first-use experience', () => {
    render(<WelcomeCarousel />)
    expect(screen.queryByText(/biometric/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Evidence-based context/i)).toBeInTheDocument()
  })
})
