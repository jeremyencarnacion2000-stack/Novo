import { render, screen } from '@testing-library/react'
import { CognitiveUpdateCard } from './cognitive-update-card'

describe('CognitiveUpdateCard', () => {
  it('labels absent planning metrics as unavailable instead of inventing numeric values', () => {
    render(<CognitiveUpdateCard content={{}} />)

    expect(screen.getAllByText('Sin datos')).toHaveLength(3)
    expect(screen.queryByText('75')).not.toBeInTheDocument()
    expect(screen.queryByText('35%')).not.toBeInTheDocument()
  })
})
