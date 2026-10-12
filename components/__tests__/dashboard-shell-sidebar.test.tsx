import React from 'react'
import { render, screen } from '@testing-library/react'
import { DashboardShell } from '../dashboard-shell'

jest.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <aside data-testid="desktop-sidebar">Desktop navigation</aside>,
}))
jest.mock('@/components/mobile-nav', () => ({
  MobileNav: () => <nav aria-label="Mobile navigation" />,
}))
jest.mock('@/components/ai/VoiceCommandHub', () => ({
  VoiceCommandHub: () => null,
}))
jest.mock('@/components/PageWrapper', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ settings: { compactMode: false, showAnimations: true } }),
}))
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }))
jest.mock('@/components/mobile-overlay-provider', () => ({
  useMobileOverlay: () => ({ activeOverlay: null, closeOverlay: jest.fn(), openOverlay: jest.fn() }),
}))
jest.mock('@/hooks/use-device-presence', () => ({ useDevicePresence: jest.fn() }))
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

function mockViewport(isDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((media: string) => ({
      matches: isDesktop,
      media,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

describe('dashboard desktop sidebar', () => {
  it('does not mount the hidden desktop sidebar on mobile', () => {
    mockViewport(false)

    render(<DashboardShell><div>Route content</div></DashboardShell>)

    expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Route content')
  })

  it('keeps the desktop sidebar available at the md breakpoint', async () => {
    mockViewport(true)

    render(<DashboardShell><div>Route content</div></DashboardShell>)

    expect(await screen.findByTestId('desktop-sidebar')).toBeInTheDocument()
  })
})
