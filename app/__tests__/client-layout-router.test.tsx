import React from 'react'
import { render, screen } from '@testing-library/react'
import ClientLayoutRouter from '@/app/client-layout-router'

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
})
