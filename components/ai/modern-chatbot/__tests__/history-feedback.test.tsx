import { fireEvent, render, screen } from '@testing-library/react'
import ModernChatbot from '../index'

let mockChat: any
jest.mock('../context', () => ({ useChatbot: () => mockChat }))
jest.mock('../message', () => ({ Message: () => null }))
jest.mock('@/components/ai/novo-thinking-pill', () => ({ NovoThinkingPill: () => <div>Thinking</div> }))
jest.mock('../welcome-hero', () => ({ DesktopHero: () => <div>Welcome</div>, MobileHero: () => null, VoiceListeningOverlay: () => null }))
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('../connectors-modal', () => ({ ConnectorsModal: () => null }))
jest.mock('@/components/billing/novo-paywall', () => ({ NovoPaywallDialog: () => null }))
jest.mock('../glowing-orb', () => ({ GlowingOrb: () => null }))
jest.mock('@/hooks/use-project-assistant', () => ({ useProjectAssistant: () => ({ work: [], status: 'ready', devices: [], delegations: [], workspaces: [] }) }))
jest.mock('@/lib/i18n', () => {
  const strings: Record<string, string> = { 'chat.history.loading': 'Cargando conversación…', 'chat.history.error': 'No se pudo cargar la conversación.', 'chat.history.retry': 'Volver a intentar' }
  return { useTranslation: () => ({ language: 'es', t: (key: string) => strings[key] ?? key }) }
})

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
})
beforeEach(() => {
  mockChat = { messages: [], streamingMessage: null, conversations: [], currentConversationId: null,
    historyStatus: 'ready', retryHistoryLoad: jest.fn(), createConversation: jest.fn(), sendMessage: jest.fn(),
    isLoading: false, twinMode: false, twinModeAvailable: false, setTwinMode: jest.fn(),
    selectedModel: 'auto', setSelectedModel: jest.fn(), availableModels: [],
  }
})

it('shows loading and retry feedback without losing the composer draft', () => {
  const view = render(<ModernChatbot />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'Borrador que quiero conservar' } })
  mockChat.historyStatus = 'loading'
  mockChat.currentConversationId = 'a'
  view.rerender(<ModernChatbot />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando conversación')
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toBeDisabled()
  expect(input).toHaveValue('Borrador que quiero conservar')
  expect(screen.queryByText('Thinking')).not.toBeInTheDocument()

  mockChat.historyStatus = 'error'
  view.rerender(<ModernChatbot />)
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la conversación')
  fireEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(mockChat.retryHistoryLoad).toHaveBeenCalledTimes(1)

  mockChat.historyStatus = 'ready'
  view.rerender(<ModernChatbot />)
  expect(screen.getByRole('textbox')).toBe(input)
  expect(input).toBeEnabled()
  expect(input).toHaveValue('Borrador que quiero conservar')
})
