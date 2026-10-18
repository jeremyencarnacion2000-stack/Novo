import React from 'react'
import { render, screen } from '@testing-library/react'
import ClientLayoutRouter from '@/app/client-layout-router'
import { useMobileOverlay } from '@/components/mobile-overlay-provider'
import userEvent from '@testing-library/user-event'

let pathname = '/'

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

jest.mock('next/dynamic', () => () => {
  return function MockApplicationShell({ children }: { children: React.ReactNode }) {
    return <div data-testid="application-shell">{children}</div>
  }
})

describe('ClientLayoutRouter public-route isolation', () => {
  it('provides working mobile navigation in Cognitive and preserves it across shell changes', async () => {
    function OverlayProbe() {
      const { activeOverlay, openOverlay } = useMobileOverlay()
      return <button onClick={() => openOverlay('navigation')}>{activeOverlay}</button>
    }
    pathname = '/cognitive'
    const user = userEvent.setup()
    const view = render(<ClientLayoutRouter><OverlayProbe /></ClientLayoutRouter>)
    await user.click(screen.getByRole('button', { name: 'none' }))
    expect(screen.getByRole('button', { name: 'navigation' })).toBeInTheDocument()
    pathname = '/today'
    view.rerender(<ClientLayoutRouter><OverlayProbe /></ClientLayoutRouter>)
    expect(screen.getByRole('button', { name: 'navigation' })).toBeInTheDocument()
  })

  it('renders the landing directly without mounting the authenticated application shell', () => {
    pathname = '/landing'

    render(
      <ClientLayoutRouter>
        <main>Landing content</main>
      </ClientLayoutRouter>,
    )

    expect(screen.getByText('Landing content')).toBeVisible()
    expect(screen.queryByTestId('application-shell')).not.toBeInTheDocument()
  })

  it('keeps the app entry resolver outside the authenticated shell', () => {
    pathname = '/app'

    render(
      <ClientLayoutRouter>
        <main>App resolver</main>
      </ClientLayoutRouter>,
    )

    expect(screen.getByText('App resolver')).toBeVisible()
    expect(screen.queryByTestId('application-shell')).not.toBeInTheDocument()
  })

  it('keeps login and signup surfaces outside the authenticated shell', () => {
    pathname = '/auth/signin'

    const { rerender } = render(
      <ClientLayoutRouter>
        <main>Sign in</main>
      </ClientLayoutRouter>,
    )

    expect(screen.getByText('Sign in')).toBeVisible()
    expect(screen.queryByTestId('application-shell')).not.toBeInTheDocument()

    pathname = '/auth/signup'
    rerender(
      <ClientLayoutRouter>
        <main>Sign up</main>
      </ClientLayoutRouter>,
    )

    expect(screen.getByText('Sign up')).toBeVisible()
    expect(screen.queryByTestId('application-shell')).not.toBeInTheDocument()
  })
})
