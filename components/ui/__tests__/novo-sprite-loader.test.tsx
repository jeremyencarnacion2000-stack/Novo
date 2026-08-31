import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { NovoSpriteLoader } from '@/components/ui/novo-sprite-loader'

describe('NovoSpriteLoader', () => {
  it('exposes a semantic companion state without changing the status copy', () => {
    const { container } = render(
      <NovoSpriteLoader variant="thinking" size="xs" label="Reviewing context" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Reviewing context')
    expect(container.querySelector('[data-variant="thinking"]')).toBeInTheDocument()
  })

  it.each(['thinking', 'listening', 'resolved'])('ships the %s sprite sheet', (variant) => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), 'public', 'art', `novo-companion-${variant}.png`),
      ),
    ).toBe(true)
  })
})
