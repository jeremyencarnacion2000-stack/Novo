import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ClientLayout from '@/app/client-layout'

jest.mock('next/navigation', () => ({
  usePathname: () => '/today',
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}))
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'test-user' } } }),
  getSession: jest.fn(),
}))
let mockPlayerReady = false
let mockDashboardShellRenders = 0
let mockGlobalPlayerMounts = 0
let mockQuickCaptureMounts = 0
jest.mock('next/dynamic', () => (loader: () => Promise<unknown>) => {
  if (String(loader).includes('command-palette')) {
    return function DeferredCommandPalette({ initialOpen }: { initialOpen?: boolean }) {
      return require('react').createElement('div', {
        role: 'dialog',
        'aria-label': 'Quick search',
        'data-initial-open': String(initialOpen),
      })
    }
  }
  if (String(loader).includes('global-player')) {
    return function DeferredPlayer(props: Record<string, unknown>) {
      mockGlobalPlayerMounts += 1
      if (!mockPlayerReady) return null
      const { GlobalPlayer } = require('@/components/music/global-player')
      return require('react').createElement(GlobalPlayer, props)
    }
  }
  if (String(loader).includes('components/quick-capture')) {
    return function DeferredQuickCapture() {
      require('react').useEffect(() => { mockQuickCaptureMounts += 1 }, [])
      return require('react').createElement('div', { 'data-testid': 'deferred-quick-capture' })
    }
  }
  if (String(loader).includes('dashboard-shell')) {
    return function CountedDashboardShell({ children }: { children: React.ReactNode }) {
      mockDashboardShellRenders += 1
      return <div>{children}</div>
    }
  }
  return ({ children }: { children: React.ReactNode }) => children ?? null
})
jest.mock('@/lib/settings-context', () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => children,
  useSettings: () => ({ settings: { showAnimations: true } }),
}))
jest.mock('@/lib/notification-context', () => ({ NotificationProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/lib/focus-context', () => ({ FocusProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/lib/scroll-container-context', () => ({ ScrollContainerProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/lib/cognitive-context', () => ({ CognitiveProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/lib/cognitive-twin-context', () => {
  const React = require('react')
  const TwinContext = React.createContext(null)

  function CognitiveTwinProvider({ children }: { children: React.ReactNode }) {
    const [twin, setTwin] = React.useState({ isInitialized: true, version: 0 })
    React.useEffect(() => {
      const update = () => setTwin((current: { isInitialized: boolean; version: number }) => ({ ...current, version: current.version + 1 }))
      window.addEventListener('test:cognitive-twin:update', update)
      return () => window.removeEventListener('test:cognitive-twin:update', update)
    }, [])

    const value = React.useMemo(() => ({ twin, isLoading: false }), [twin])
    return React.createElement(TwinContext.Provider, { value }, children)
  }

  return {
    CognitiveTwinProvider,
    useCognitiveTwin: () => React.useContext(TwinContext),
  }
})
jest.mock('@/components/mobile-overlay-provider', () => ({ MobileOverlayProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/hooks/use-session-tracking', () => ({ useSessionTracking: () => undefined }))
jest.mock('@/hooks/use-novo-motion-policy', () => ({ useNovoMotionPolicy: () => 'full' }))
jest.mock('@/hooks/use-cognitive-theme', () => ({ useCognitiveTheme: () => undefined }))
jest.mock('@/components/ambient-context-heartbeat', () => ({ AmbientContextHeartbeat: () => null }))
jest.mock('@/components/liquid-glass/web-component-loader', () => ({ LiquidGlassWebComponentLoader: () => null }))
jest.mock('@/hooks/use-sync-queue', () => ({ useSyncQueue: () => undefined }))
jest.mock('@/components/offline-indicator', () => ({ OfflineIndicator: () => null }))
jest.mock('@/components/network-status', () => ({ NetworkStatus: () => null }))
jest.mock('@/lib/register-sw', () => ({ registerServiceWorker: jest.fn() }))

describe('authenticated shell startup', () => {
  it('shows the route while the optional music player chunk is still loading', async () => {
    render(<ClientLayout><main>Contenido de Hoy</main></ClientLayout>)
    expect(await screen.findByText('Contenido de Hoy')).toBeVisible()
  })

  it('does not rerender the authenticated route when only the Cognitive Twin context changes', async () => {
    mockDashboardShellRenders = 0
    render(<ClientLayout><main>Contenido estable</main></ClientLayout>)
    expect(await screen.findByText('Contenido estable')).toBeVisible()
    const rendersBeforeTwinUpdate = mockDashboardShellRenders

    act(() => window.dispatchEvent(new Event('test:cognitive-twin:update')))

    expect(mockDashboardShellRenders).toBe(rendersBeforeTwinUpdate)
  })

  it('does not mount the global music player until playback is requested', async () => {
    mockPlayerReady = false
    mockGlobalPlayerMounts = 0

    render(<ClientLayout><main>Contenido sin música</main></ClientLayout>)

    expect(await screen.findByText('Contenido sin música')).toBeVisible()
    expect(mockGlobalPlayerMounts).toBe(0)
  })

  it('mounts the global music player when a track becomes active', async () => {
    mockPlayerReady = false
    mockGlobalPlayerMounts = 0

    render(<ClientLayout><main>Reproducción activa</main></ClientLayout>)
    expect(await screen.findByText('Reproducción activa')).toBeVisible()
    expect(mockGlobalPlayerMounts).toBe(0)

    act(() => {
      const { usePlayerStore } = require('@/lib/player-store')
      usePlayerStore.setState({ currentTrack: { id: 'track-1' } })
    })

    expect(mockGlobalPlayerMounts).toBe(1)
    act(() => {
      const { usePlayerStore } = require('@/lib/player-store')
      usePlayerStore.setState({ currentTrack: null })
    })
  })

  it('replays an early mobile music intent when the player chunk becomes ready', async () => {
    mockPlayerReady = false
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 2 })
    const anchor = document.createElement('script')
    document.head.appendChild(anchor)

    const ui = <ClientLayout><main>Contenido de Hoy</main></ClientLayout>
    const { rerender } = render(ui)
    expect(await screen.findByText('Contenido de Hoy')).toBeVisible()

    act(() => window.dispatchEvent(new CustomEvent('youtube:load-api')))
    mockPlayerReady = true
    rerender(<ClientLayout><main>Contenido de Hoy</main></ClientLayout>)

    expect(await screen.findByText('Contenido de Hoy')).toBeVisible()
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBeNull()
    anchor.remove()
  })

  it('loads the command palette only on intent and opens on the first shortcut', async () => {
    render(<ClientLayout><main>Contenido de Hoy</main></ClientLayout>)
    expect(await screen.findByText('Contenido de Hoy')).toBeVisible()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380))
    })
    expect(screen.queryByRole('dialog', { name: 'Quick search' })).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('dialog', { name: 'Quick search' })).toHaveAttribute('data-initial-open', 'true')
  })

  it('loads Quick Capture only after the global shortcut is requested', async () => {
    mockQuickCaptureMounts = 0
    render(<ClientLayout><main>Quick Capture deferred</main></ClientLayout>)
    expect(await screen.findByText('Quick Capture deferred')).toBeVisible()

    expect(screen.queryByTestId('deferred-quick-capture')).not.toBeInTheDocument()
    expect(mockQuickCaptureMounts).toBe(0)

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true, shiftKey: true })

    expect(await screen.findByTestId('deferred-quick-capture')).toBeInTheDocument()
    expect(mockQuickCaptureMounts).toBe(1)
  })

  it('opens mobile search before secondary widgets become ready', async () => {
    render(<ClientLayout><main>Contenido de Hoy</main></ClientLayout>)
    expect(await screen.findByText('Contenido de Hoy')).toBeVisible()

    act(() => window.dispatchEvent(new Event('open-command-palette')))
    expect(await screen.findByRole('dialog', { name: 'Quick search' })).toHaveAttribute('data-initial-open', 'true')
  })
})
