import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '../chat-input'

const sendMessage = jest.fn().mockResolvedValue(undefined)
let mockConversationId = 'chat-a'

jest.mock('../context', () => ({
  useChatbot: () => ({
    sendMessage,
    currentConversationId: mockConversationId,
    isLoading: false,
    twinMode: false,
    setTwinMode: jest.fn(),
    twinModeAvailable: true,
    selectedModel: 'auto',
    setSelectedModel: jest.fn(),
    availableModels: [{ id: 'auto', name: 'Auto', description: 'Auto', enabled: true }],
  }),
}))
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('../connectors-modal', () => ({ ConnectorsModal: () => null }))
jest.mock('@/components/billing/novo-paywall', () => ({ NovoPaywallDialog: () => null }))
jest.mock('../glowing-orb', () => ({ GlowingOrb: () => null }))

describe('ChatInput', () => {
  beforeEach(() => { sendMessage.mockClear(); mockConversationId = 'chat-a' })

  it('delegates first-message conversation creation to sendMessage', async () => {
    const user = userEvent.setup()
    render(<ChatInput />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'Hola Novo')
    await user.keyboard('{Enter}')

    expect(sendMessage).toHaveBeenCalledWith('Hola Novo', [], false)
  })

  it('sends multiple attached documents into the active chat without requiring a separate prompt', async () => {
    const user = userEvent.setup()
    const { container } = render(<ChatInput />)
    const files = [
      new File(['uno'], 'plan.md', { type: 'text/markdown' }),
      new File(['dos'], 'notes.txt', { type: 'text/plain' }),
    ]
    const documentInput = container.querySelector('input[type="file"]:last-of-type')
    expect(documentInput).not.toBeNull()
    fireEvent.change(documentInput!, { target: { files } })

    const send = screen.getByTitle('Enviar')
    expect(send).toBeEnabled()
    await user.click(send)

    expect(sendMessage).toHaveBeenCalledWith(
      'Analiza los 2 archivos adjuntos y resume lo más importante.',
      files,
      false,
    )
  })

  it('opens the progressive tools sheet and closes it with Escape', async () => {
    const user = userEvent.setup()
    render(<ChatInput />)
    await user.click(screen.getByRole('button', { name: 'Adjuntar y herramientas' }))
    expect(await screen.findByText('Herramientas')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Herramientas')).not.toBeInTheDocument())
  })

  it('appends dictation to the current draft and keeps attachments until manual send', async () => {
    const { container } = render(<ChatInput />)
    const file = new File(['plan'], 'plan.txt', { type: 'text/plain' })
    fireEvent.change(container.querySelector('input[type="file"]:last-of-type')!, { target: { files: [file] } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Novo, ' } })
    fireEvent(window, new CustomEvent('novo:voice-transcript', { detail: { text: 'revisa este plan' } }))
    expect(screen.getByRole('textbox')).toHaveValue('Novo, revisa este plan')
    expect(sendMessage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTitle('Enviar'))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Novo, revisa este plan', [file], false))
  })

  it('ignores dictation while the selected history is unavailable', () => {
    render(<ChatInput disabled />)
    fireEvent(window, new CustomEvent('novo:voice-transcript', { detail: { text: 'No mezclar conversaciones' } }))
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('cancels pending dictation when changing conversation', () => {
    const cancel = jest.fn()
    window.addEventListener('novo:voice-cancel', cancel)
    try {
      const view = render(<ChatInput />)
      mockConversationId = 'chat-b'
      view.rerender(<ChatInput />)
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Dictar mensaje' })).toHaveAccessibleDescription('El dictado se añade al borrador. Revísalo antes de enviarlo.')
    } finally { window.removeEventListener('novo:voice-cancel', cancel) }
  })
})
