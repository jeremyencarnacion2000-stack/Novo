import React, { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeminiLiveOrb } from '@/components/ai/GeminiLiveOrb'
import { MobileNav } from '@/components/mobile-nav'
import {
  MobileOverlayProvider,
  useMobileOverlay,
} from '@/components/mobile-overlay-provider'
import { FloatingMusicWidget } from '@/components/music/floating-music-widget'

const push = jest.fn()
let pathname = '/music'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}))

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/hooks/use-modal-flip', () => ({
  useModalFlip: () => (done: () => void) => done(),
}))

jest.mock('@/hooks/use-drag-to-dismiss', () => ({
  useDragToDismiss: () => ({ current: null }),
}))

jest.mock('@/components/ui/GlassSurface', () => ({
  GlassSurface: () => <div data-testid="glass-surface" />,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

jest.mock('@/components/ui/slider', () => ({
  Slider: () => <div role="slider" aria-label="Volume" aria-valuenow={50} />,
}))

jest.mock('@/lib/cognitive-context', () => ({
  useCognitiveEngine: () => ({ bioState: null }),
}))

jest.mock('@/lib/focus-context', () => ({
  useFocus: () => ({
    isActive: false,
    time: 0,
    mode: 'work',
    formatTime: () => '00:00',
  }),
}))

jest.mock('@/lib/player-store', () => ({
  usePlayerStore: () => ({
    currentTrack: {
      id: 'track-1',
      uri: 'track-1',
      name: 'Policy Track',
      artist: 'Novo',
      image: '/cover.png',
      duration_ms: 180000,
    },
    isPlaying: false,
    isOpen: true,
    togglePlayPause: jest.fn(),
    nextTrack: jest.fn(),
    previousTrack: jest.fn(),
    setVolume: jest.fn(),
    volume: 0.5,
    progress: 1000,
    isReady: true,
  }),
}))

jest.mock('@/components/music/now-playing-fullscreen', () => ({
  NowPlayingFullscreen: () => null,
}))

class MockVisualViewport extends EventTarget {
  height = 844
}

let visualViewport: MockVisualViewport

function setMobileViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
  visualViewport = new MockVisualViewport()
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })
}

function PolicySurface({ withModal = false }: { withModal?: boolean }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <MobileOverlayProvider>
      <PolicyContent modalOpen={modalOpen} setModalOpen={setModalOpen} withModal={withModal} />
    </MobileOverlayProvider>
  )
}

function PolicyContent({ modalOpen, setModalOpen, withModal }: { modalOpen: boolean; setModalOpen: (open: boolean) => void; withModal: boolean }) {
  const overlay = useMobileOverlay()
  return <>
    <MobileNav />
    <GeminiLiveOrb />
    <FloatingMusicWidget />
    {withModal && <>
      <button onClick={() => { setModalOpen(true); overlay.setModalOpen(true) }}>Open test modal</button>
      {modalOpen && <div role="dialog" aria-modal="true" aria-label="Test modal"><button>Modal action</button></div>}
    </>}
  </>
}

function OverlayReplacementProbe() {
  const { activeOverlay, openOverlay } = useMobileOverlay()

  return (
    <>
      <output aria-label="Active overlay">{activeOverlay}</output>
      <button onClick={() => openOverlay('voice')}>Open voice overlay</button>
      <button onClick={() => openOverlay('utility')}>Open utility overlay</button>
    </>
  )
}

describe('mobile overlay policy', () => {
  beforeEach(() => {
    pathname = '/music'
    push.mockReset()
    setMobileViewport(390)
    window.history.replaceState({}, '', '/music')
  })

  it('gives the navigation sheet exclusive ownership over voice and music utilities at 390px', async () => {
    const user = userEvent.setup()
    render(<PolicySurface />)

    expect(screen.getByTitle(/presionado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reproductor a pantalla completa/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()
    expect(screen.queryByTitle(/presionado/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reproductor a pantalla completa/i })).not.toBeInTheDocument()
  })

  it('replaces one secondary overlay with another instead of stacking them', async () => {
    const user = userEvent.setup()
    render(
      <MobileOverlayProvider>
        <OverlayReplacementProbe />
      </MobileOverlayProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open voice overlay' }))
    expect(screen.getByRole('status', { name: 'Active overlay' })).toHaveTextContent('voice')

    await user.click(screen.getByRole('button', { name: 'Open utility overlay' }))
    expect(screen.getByRole('status', { name: 'Active overlay' })).toHaveTextContent('utility')
  })

  it('removes secondary utilities and background navigation targets from the accessibility tree while a modal is open', async () => {
    const user = userEvent.setup()
    render(<PolicySurface withModal />)

    await user.click(screen.getByRole('button', { name: 'Open test modal' }))

    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).not.toBeInTheDocument()
      expect(screen.queryByTitle(/presionado/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reproductor a pantalla completa/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Modal action' })).toBeInTheDocument()
  })

  it('removes the primary navigation from the accessibility tree while its sheet is open', async () => {
    const user = userEvent.setup()
    render(<PolicySurface />)

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('mobile-primary-target')).toHaveLength(0)
  })

  it('does not suppress desktop utilities when a provider-owned modal signal is active', async () => {
    setMobileViewport(1024)
    function DesktopProbe() {
      const { setModalOpen } = useMobileOverlay()
      return <button onClick={() => setModalOpen(true)}>Open desktop modal</button>
    }
    render(
      <MobileOverlayProvider>
        <DesktopProbe />
        <GeminiLiveOrb />
        <FloatingMusicWidget />
      </MobileOverlayProvider>,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Open desktop modal' }))
    expect(screen.getByTitle(/presionado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reproductor a pantalla completa/i })).toBeInTheDocument()
  })

  it('consumes browser Back by closing the active sheet before route navigation', async () => {
    const user = userEvent.setup()
    render(<PolicySurface />)

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()

    act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: {} })))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Workspace menu' })).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/music')
    expect(push).not.toHaveBeenCalled()
  })

  it('suppresses the primary and secondary mobile layers when an editable control opens the visual keyboard', async () => {
    render(
      <MobileOverlayProvider>
        <input aria-label="Editable field" />
        <MobileNav />
        <GeminiLiveOrb />
      </MobileOverlayProvider>,
    )

    screen.getByRole('textbox', { name: 'Editable field' }).focus()
    visualViewport.height = 600
    act(() => visualViewport.dispatchEvent(new Event('resize')))

    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).not.toBeInTheDocument()
      expect(screen.queryByTitle(/presionado/i)).not.toBeInTheDocument()
    })
  })

  it.each([320, 360, 390, 412, 430])(
    'keeps five 44px primary targets and provider-owned safe-area spacing at %ipx',
    (width) => {
      setMobileViewport(width)
      render(
        <MobileOverlayProvider>
          <MobileNav />
        </MobileOverlayProvider>,
      )

      const navigation = screen.getByRole('navigation', { name: 'Primary mobile navigation' })
      const targets = screen.getAllByTestId('mobile-primary-target')
      const overlayRoot = screen.getByTestId('mobile-overlay-root')

      expect(targets).toHaveLength(5)
      targets.forEach((target) => {
        expect(target).toHaveClass('min-w-[44px]')
        expect(target).toHaveClass('min-h-[44px]')
      })
      expect(overlayRoot).toHaveStyle('--mobile-safe-area-bottom: env(safe-area-inset-bottom)')
      expect(navigation).toHaveStyle('padding-bottom: var(--mobile-safe-area-bottom)')
    },
  )
})
