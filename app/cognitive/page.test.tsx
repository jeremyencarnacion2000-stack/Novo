import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CognitivePage from './page'

jest.mock('next/dynamic', () => () => function OperationalPlan() { return <button>Plan operativo</button> })
jest.mock('@/lib/cognitive-context', () => ({ useCognitiveEngine: () => ({ chronotype: 'intermediate', setChronotype: jest.fn() }) }))
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es' }) }))
jest.mock('@/components/cognitive/cognitive-command-surface', () => ({ CognitiveCommandSurface: ({ onPrimaryAction }: any) => <button onClick={onPrimaryAction}>Revisar recomendación</button> }))

describe('integrated Cognitive page', () => {
  it('has one page heading and real chat/connections destinations', () => {
    const view = render(<CognitivePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu contexto')
    expect(screen.getByRole('link', { name: 'Hablar con Novo' })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: 'Conexiones' })).toHaveAttribute('href', '/connectors')
    expect(view.container.querySelector('main')).toBeNull()
    expect(view.container.querySelector('.cognitive-shell')).toBeNull()
  })
  it('opens the actual operating plan without losing the current context', async () => {
    const user = userEvent.setup()
    render(<CognitivePage />)
    expect(screen.queryByText('Plan operativo')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revisar recomendación' }))
    await waitFor(() => expect(screen.getByText('Plan operativo')).toBeVisible())
    expect(document.querySelector('details')).toHaveAttribute('open')
    expect(screen.getByRole('heading', { name: 'Tu contexto' })).toBeInTheDocument()
  })
})
