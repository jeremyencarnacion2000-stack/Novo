import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { ChatbotProvider, useChatbot } from '../context'

let mockSession: { data: { user: { id: string } } | null; status: 'authenticated' | 'unauthenticated' | 'loading' } = {
  data: { user: { id: 'user-a' } },
  status: 'authenticated',
}

jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

function Probe() {
  const { conversations } = useChatbot()
  return <output data-testid="conversations">{conversations.map(conversation => conversation.id).join(',')}</output>
}

describe('ChatbotProvider account isolation', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSession = { data: { user: { id: 'user-a' } }, status: 'authenticated' }
  })

  it('ignores a late conversation response from the previous account', async () => {
    const firstRead = deferred<Response>()
    const secondRead = deferred<Response>()
    let conversationRead = 0
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url === '/api/ai-conversations') {
        conversationRead += 1
        return (conversationRead === 1 ? firstRead.promise : secondRead.promise)
      }
      if (url === '/api/billing/status') {
        return Promise.resolve({ ok: true, json: async () => ({ plan: 'free' }) } as Response)
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })

    const view = render(
      <ChatbotProvider>
        <Probe />
      </ChatbotProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
    view.rerender(
      <ChatbotProvider>
        <Probe />
      </ChatbotProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))

    await act(async () => {
      secondRead.resolve({
        ok: true,
        json: async () => [{ id: 'conversation-b', title: 'B', messages: [], createdAt: '', updatedAt: '' }],
      } as Response)
    })
    await waitFor(() => expect(screen.getByTestId('conversations')).toHaveTextContent('conversation-b'))

    await act(async () => {
      firstRead.resolve({
        ok: true,
        json: async () => [{ id: 'conversation-a', title: 'A', messages: [], createdAt: '', updatedAt: '' }],
      } as Response)
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('conversations')).toHaveTextContent('conversation-b')
    expect(screen.getByTestId('conversations')).not.toHaveTextContent('conversation-a')
  })
})
