import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '../chat-input'

const sendMessage = jest.fn().mockResolvedValue(undefined)

jest.mock('../context', () => ({
  useChatbot: () => ({
    sendMessage,
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
  beforeEach(() => sendMessage.mockClear())

  it('delegates first-message conversation creation to sendMessage', async () => {
    const user = userEvent.setup()
    render(<ChatInput />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'Hola Novo')
    await user.keyboard('{Enter}')

    expect(sendMessage).toHaveBeenCalledWith('Hola Novo', [], false)
  })

  it('opens the progressive tools sheet and closes it with Escape', async () => {
    const user = userEvent.setup()
    render(<ChatInput />)
    await user.click(screen.getByRole('button', { name: 'Adjuntar y herramientas' }))
    expect(await screen.findByText('Herramientas')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Herramientas')).not.toBeInTheDocument())
  })
})
