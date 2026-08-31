import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModernChatbot from '../index'

const createConversation = jest.fn()

jest.mock('../context', () => ({
  useChatbot: () => ({
    createConversation,
    sendMessage: jest.fn(),
    messages: [],
    streamingMessage: null,
    twinMode: false,
    setTwinMode: jest.fn(),
    twinModeAvailable: true,
    conversations: [],
    currentConversationId: null,
    setCurrentConversationId: jest.fn(),
    deleteConversation: jest.fn(),
    sidebarCollapsed: false,
    setSidebarCollapsed: jest.fn(),
  }),
}))
jest.mock('../chat-input', () => ({ ChatInput: () => <div /> }))
jest.mock('../chat-area', () => ({ ChatArea: () => <div>Chat messages</div> }))
jest.mock('../welcome-hero', () => ({
  DesktopHero: () => <div>Desktop hero</div>,
  MobileHero: () => <div>Mobile hero</div>,
  VoiceListeningOverlay: () => null,
}))
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'es' }) }))

describe('ModernChatbot conversation history', () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver
  })

  test('opens history as a bounded edge drawer instead of a full-screen blank surface on desktop', async () => {
    const user = userEvent.setup()
    render(<ModernChatbot />)

    await user.click(screen.getByRole('button', { name: 'Ver historial' }))

    const drawer = screen.getByRole('dialog', { name: 'Historial de conversaciones' })
    expect(drawer).toHaveClass('md:w-[360px]')
    expect(drawer).not.toHaveClass('inset-0')
    expect(screen.getByTestId('conversation-history-backdrop')).toHaveClass('bg-black/45')
  })
})
