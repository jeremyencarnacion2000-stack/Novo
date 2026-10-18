import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import CognitiveClientLayout from './cognitive-client-layout'

let mockStatus = 'authenticated'
let mockLoading = true
let mockInitialized = false
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ usePathname: () => '/cognitive', useRouter: () => ({ replace: mockReplace }) }))
jest.mock('next-auth/react', () => ({ SessionProvider: ({ children }: any) => children, useSession: () => ({ status: mockStatus }) }))
jest.mock('@/lib/settings-context', () => ({ SettingsProvider: ({ children }: any) => children }))
jest.mock('@/lib/cognitive-context', () => ({ CognitiveProvider: ({ children }: any) => children }))
jest.mock('@/lib/cognitive-twin-context', () => ({ CognitiveTwinProvider: ({ children }: any) => children, useCognitiveTwin: () => ({ twin: { isInitialized: mockInitialized }, isLoading: mockLoading }) }))
jest.mock('@/hooks/use-cognitive-theme', () => ({ useCognitiveTheme: () => undefined }))
jest.mock('@/components/ambient-context-heartbeat', () => ({ AmbientContextHeartbeat: () => null }))
jest.mock('@/components/app-motion-settings', () => ({ AppMotionSettings: ({ children }: any) => children }))
jest.mock('@/components/liquid-glass/web-component-loader', () => ({ LiquidGlassWebComponentLoader: () => null }))
jest.mock('@/components/cognitive/cognitive-route-shell', () => ({ CognitiveRouteShell: ({ children }: any) => <><nav aria-label="Novo navigation" />{children}</> }))
jest.mock('@/components/ui/novo-sprite-loader', () => ({ NovoSpriteLoader: () => <span>Loading</span> }))

describe('Cognitive session and navigation availability', () => {
  beforeEach(() => { mockStatus = 'authenticated'; mockLoading = true; mockInitialized = false; mockReplace.mockReset() })
  it('keeps authenticated navigation and content while the Twin synchronizes', () => {
    render(<CognitiveClientLayout><p>Contexto</p></CognitiveClientLayout>)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText('Contexto')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
  it('does not confuse a failed Twin sync with an authoritative onboarding decision', () => {
    mockLoading = false
    render(<CognitiveClientLayout><p>Contexto</p></CognitiveClientLayout>)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar su configuración' })).toHaveAttribute('href', '/onboarding')
    expect(mockReplace).not.toHaveBeenCalled()
  })
  it('never renders private content for an expired session', async () => {
    mockStatus = 'unauthenticated'
    render(<CognitiveClientLayout><p>Contexto privado</p></CognitiveClientLayout>)
    expect(screen.queryByText('Contexto privado')).not.toBeInTheDocument()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/signin?callbackUrl=%2Fcognitive'))
  })
})
