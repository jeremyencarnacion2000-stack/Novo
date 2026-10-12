import { render } from '@testing-library/react'
import { Card } from '@/components/ui/card'

describe('card surface material', () => {
  it('keeps standard cards attached to the page backdrop', () => {
    const { container } = render(<Card>Contenido</Card>)
    const card = container.querySelector<HTMLElement>('[data-slot="card"]')

    expect(card).toHaveClass('novo-card-surface')
    expect(card).not.toHaveClass('isolate')
    expect(card).toHaveAttribute('data-variant', 'primary')
  })
})
