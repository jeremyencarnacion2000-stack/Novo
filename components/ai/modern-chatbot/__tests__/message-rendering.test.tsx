import React from 'react'
import { render, screen } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import { Message } from '../message'
import type { Message as MessageType } from '../types'

jest.mock('react-markdown', () => ({ __esModule: true, default: jest.fn(({ children }) => <p>{children}</p>) }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }))
jest.mock('../context', () => ({ useChatbot: () => ({}) }))

describe('unchanged message formatting during chat updates', () => {
  beforeEach(() => jest.mocked(ReactMarkdown).mockClear())

  it.each(['plain', 'blocks'])('keeps %s markdown cached while message actions still update', kind => {
    const message = (content: string, liked = false): MessageType => ({
      id: 'existing-message', role: 'assistant', content, liked,
      timestamp: '2026-11-01T12:00:00Z',
      ...(kind === 'blocks' ? { blocks: [{ id: 'text-block', type: 'markdown', content }] } : {}),
    })
    const view = render(<Message message={message('Respuesta anterior')} />)
    expect(ReactMarkdown).toHaveBeenCalledTimes(1)

    view.rerender(<Message message={message('Respuesta anterior', true)} />)
    expect(screen.getByTitle('Me gusta')).toHaveClass('bg-white/10')
    expect(ReactMarkdown).toHaveBeenCalledTimes(1)

    view.rerender(<Message message={message('Respuesta actualizada', true)} />)
    expect(screen.getByText('Respuesta actualizada')).toBeInTheDocument()
    expect(ReactMarkdown).toHaveBeenCalledTimes(2)
  })
})
