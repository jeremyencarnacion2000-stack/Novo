import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { ChatArea } from '../chat-area'

let mockChat: any
jest.mock('../context', () => ({ useChatbot: () => mockChat }))
jest.mock('../message', () => ({ Message: ({ message }: any) => <p>{message.content}</p> }))
jest.mock('@/components/ai/novo-thinking-pill', () => ({ NovoThinkingPill: () => <div>Thinking</div> }))

describe('chat interaction while text streams', () => {
  let frames: Map<number, FrameRequestCallback>
  const frame = () => act(() => {
    const callbacks = [...frames.values()]; frames.clear()
    callbacks.forEach(callback => callback(performance.now()))
  })
  const mount = () => {
    const view = render(<ChatArea />)
    const scroller = view.container.querySelector<HTMLElement>('[data-lenis-prevent]')!
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    scroller.scrollTo = jest.fn(({ top }: ScrollToOptions) => { scroller.scrollTop = top ?? 0 }) as typeof scroller.scrollTo
    scroller.scrollTop = 600; fireEvent.scroll(scroller)
    frame()
    jest.mocked(scroller.scrollTo).mockClear()
    return { ...view, scroller }
  }
  beforeEach(() => {
    mockChat = { messages: [{ id: 'old', role: 'assistant', content: 'Existing answer' }], streamingMessage: null, isLoading: false, currentConversationId: 'conversation' }
    frames = new Map(); let id = 0
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
  })
  afterEach(() => jest.restoreAllMocks())

  it('keeps the reader position when inspecting earlier messages during a response', () => {
    const { scroller, rerender } = mount()
    scroller.scrollTop = 200; fireEvent.scroll(scroller)
    mockChat.streamingMessage = { id: 'live', role: 'assistant', content: 'New text' }
    rerender(<ChatArea />); frame()
    expect(scroller.scrollTop).toBe(200)
    expect(scroller.scrollTo).not.toHaveBeenCalled()
  })

  it('does not restart a smooth scroll for every streamed text update', () => {
    const { scroller, rerender } = mount()
    scroller.scrollTop = 600; fireEvent.scroll(scroller)
    mockChat.streamingMessage = { id: 'live', role: 'assistant', content: 'New text' }
    rerender(<ChatArea />)
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1100 })
    frame()
    expect(scroller.scrollTop).toBe(1100)
    expect(scroller.scrollTo).not.toHaveBeenCalled()
  })

  it('does not move the page when an existing message gets a reaction', () => {
    const { scroller, rerender } = mount()
    scroller.scrollTop = 200; fireEvent.scroll(scroller)
    mockChat.messages = [{ ...mockChat.messages[0], liked: true }]
    rerender(<ChatArea />); frame()
    expect(scroller.scrollTop).toBe(200)
    expect(scroller.scrollTo).not.toHaveBeenCalled()
  })

  it('returns to the latest message when the user sends a new prompt', () => {
    const { scroller, rerender } = mount()
    scroller.scrollTop = 200; fireEvent.scroll(scroller)
    mockChat.messages = [...mockChat.messages, { id: 'new', role: 'user', content: 'My prompt' }]
    rerender(<ChatArea />); frame()
    expect(scroller.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('keeps following through intermediate frames of the prompt smooth scroll', () => {
    const { scroller, rerender } = mount()
    scroller.scrollTop = 200; fireEvent.scroll(scroller)
    jest.mocked(scroller.scrollTo).mockImplementation(() => {})
    mockChat.messages = [...mockChat.messages, { id: 'new', role: 'user', content: 'My prompt' }]
    rerender(<ChatArea />); frame()
    scroller.scrollTop = 300; fireEvent.scroll(scroller)
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1100 })
    mockChat.streamingMessage = { id: 'live', role: 'assistant', content: 'A growing response' }
    rerender(<ChatArea />); frame()
    expect(scroller.scrollTop).toBe(1100)
  })
})
