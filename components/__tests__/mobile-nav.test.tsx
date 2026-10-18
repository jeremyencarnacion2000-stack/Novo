import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MobileNav } from '../mobile-nav'
import { MobileOverlayProvider } from '../mobile-overlay-provider'
import { AppSidebar } from '../app-sidebar'
import { SidebarProvider } from '../ui/sidebar'
import { QuickActions } from '../quick-actions'

const push = jest.fn()
let pathname = '/today'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}))

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'sidebar.dashboard': 'Dashboard',
      'sidebar.cognitive_engine': 'Cognitivo',
      'sidebar.chat': 'Chat',
      'sidebar.activity': 'Actividad',
      'sidebar.overview': 'Overview',
      'sidebar.today': 'Today',
      'sidebar.workspace': 'Workspace',
      'sidebar.more': 'More',
      'sidebar.routines': 'Workout',
      'sidebar.projects': 'Projects',
      'sidebar.checklist': 'Checklist',
      'sidebar.calendar': 'Calendar',
      'sidebar.connectors': 'Connectors',
      'sidebar.analytics': 'Analytics',
      'sidebar.focus': 'Focus',
      'sidebar.trackers': 'Trackers',
    }[key] ?? key),
  }),
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}))

jest.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ isSettingsOpen: false, setSettingsOpen: jest.fn() }),
}))

jest.mock('@/lib/cognitive-twin-context', () => ({
  useCognitiveTwin: () => ({ twin: {} }),
}))

jest.mock('@/components/smooth-scroll-provider', () => ({
  SmoothScrollProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/use-modal-flip', () => ({
  useModalFlip: () => (done: () => void) => done(),
}))

jest.mock('@/components/ui/GlassSurface', () => ({
  GlassSurface: (props: any) => (
    <div
      data-testid={props['data-testid']}
      data-glass-refractive={props.refractive ? 'true' : undefined}
      data-glass-preset={props.preset}
      data-glass-priority={props.refractivePriority}
      data-glass-active={props.refractiveActive === false ? 'false' : 'true'}
      data-navigation-material={props.navigationMaterial}
    />
  ),
}))

function renderMobileNav() {
  return render(
    <MobileOverlayProvider>
      <MobileNav />
    </MobileOverlayProvider>,
  )
}

function finishNavigationFlight() {
  act(() => {
    document.querySelector('[data-liquid-morph-panel]')?.dispatchEvent(new Event('novo:nav-morph-rest'))
  })
}

describe('MobileNav', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  beforeEach(() => {
    pathname = '/today'
    push.mockReset()
  })

  it('returns to the real Dashboard root instead of the Today subpage', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Dashboard' }))

    expect(push).toHaveBeenCalledWith('/')
  })

  it('keeps the Cognitive Twin core destinations reachable with canonical routes', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Cognitivo' }))
    await user.click(screen.getByRole('button', { name: 'Chat' }))
    await user.click(screen.getByRole('button', { name: 'Actividad' }))

    expect(push).toHaveBeenNthCalledWith(1, '/cognitive')
    expect(push).toHaveBeenNthCalledWith(2, '/chat')
    expect(push).toHaveBeenNthCalledWith(3, '/activity')
  })

  it('keeps Workout out of primary mobile navigation while preserving its More route', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    const primaryNavigation = screen.getByRole('navigation', { name: 'Primary mobile navigation' })
    expect(within(primaryNavigation).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(within(primaryNavigation).getByRole('button', { name: 'Cognitivo' })).toBeInTheDocument()
    expect(within(primaryNavigation).getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(within(primaryNavigation).getByRole('button', { name: 'Actividad' })).toBeInTheDocument()
    expect(within(primaryNavigation).queryByRole('button', { name: 'Workout' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Workout' }))
    expect(push).toHaveBeenCalledWith('/routines')
  })

  it('navigates from the workspace drawer without undoing the selected route', async () => {
    const user = userEvent.setup()
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => undefined)
    const replaceSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => undefined)
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('button', { name: 'Projects' }))

    expect(push).toHaveBeenCalledWith('/projects')
    expect(backSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()

    backSpy.mockRestore()
    replaceSpy.mockRestore()
  })

  it('never mutates history while opening or navigating from the drawer', async () => {
    // Regression: synthetic overlay history entries raced with Next.js'
    // pushState during in-drawer navigation and bounced users back to the
    // route they came from. The drawer must not touch history at all.
    const user = userEvent.setup()
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => undefined)
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('button', { name: 'Calendar' }))

    expect(push).toHaveBeenCalledWith('/calendar')
    expect(pushStateSpy).not.toHaveBeenCalled()
    expect(replaceStateSpy).not.toHaveBeenCalled()

    pushStateSpy.mockRestore()
    replaceStateSpy.mockRestore()
  })

  it('keeps Workout out of the desktop Overview group', () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    )

    const overviewGroup = screen.getByText('Overview').closest('[data-sidebar="group"]')
    expect(overviewGroup).not.toBeNull()
    if (!(overviewGroup instanceof HTMLElement)) {
      throw new Error('Overview sidebar group was not found')
    }

    expect(within(overviewGroup).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(within(overviewGroup).getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(within(overviewGroup).getByRole('link', { name: 'Cognitivo' })).toBeInTheDocument()
    expect(within(overviewGroup).getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(within(overviewGroup).getByRole('link', { name: 'Actividad' })).toBeInTheDocument()
    expect(within(overviewGroup).queryByRole('link', { name: 'Workout' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Workout' })).toHaveAttribute('href', '/routines')
  })

  it('keeps the mobile navigation rail and plus as separate glass controls at rest', () => {
    renderMobileNav()

    const rail = screen.getByTestId('mobile-nav-rail-glass')
    const plus = screen.getByTestId('mobile-nav-plus-glass')
    const sharedOrigin = document.querySelector('[data-flip-from="mobile-nav-panel"]')

    expect(rail).not.toBe(plus)
    expect(rail).toHaveAttribute('data-glass-preset', 'navigation')
    expect(plus).toHaveAttribute('data-glass-preset', 'navigation')
    expect(sharedOrigin).toContainElement(rail)
    expect(sharedOrigin).toContainElement(plus)
  })

  it('carries primary destinations into the panel that replaces the rail', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const drawer = screen.getByRole('dialog', { name: 'Workspace menu' })
    for (const destination of ['Dashboard', 'Cognitivo', 'Chat', 'Actividad']) {
      expect(within(drawer).getByRole('button', { name: destination })).toBeInTheDocument()
    }
  })

  it('keeps the shared-element nav origin mounted while the workspace menu is open', async () => {
    const user = userEvent.setup()
    renderMobileNav()
    const originalRail = document.querySelector('[data-flip-from="mobile-nav-panel"]')
    expect(originalRail).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const currentRail = document.querySelector('[data-flip-from="mobile-nav-panel"]')
    expect(currentRail).toBe(originalRail)
    expect(currentRail?.querySelectorAll('button')).toHaveLength(5)
    expect(currentRail?.querySelector('[aria-label="Close menu"]')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()
  })

  it('morphs the plus control into the drawer close control and closes from that shared element', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    const openButton = screen.getByRole('button', { name: 'Open menu' })
    expect(openButton.querySelector('[data-shared-item="mobile-nav-close"]')).toHaveProperty('tagName', 'svg')

    await user.click(openButton)

    const drawer = screen.getByRole('dialog', { name: 'Workspace menu' })
    const closeButton = within(drawer).getByRole('button', { name: 'Close menu' })
    expect(closeButton.querySelector('[data-shared-item="mobile-nav-close"]')).toHaveProperty('tagName', 'svg')

    await user.click(closeButton)

    finishNavigationFlight()

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Workspace menu' })).not.toBeInTheDocument())
  })

  it('uses a thin selection overlay instead of nesting another lens in the panel', async () => {
    pathname = '/calendar'
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const selected = screen.getByRole('button', { name: 'Calendar' })
    expect(selected).toHaveAttribute('aria-current', 'page')
    expect(selected.querySelector('[data-nav-selection]')).not.toBeNull()
    expect(selected.querySelector('[data-glass-refractive]')).toBeNull()
  })

  it('uses the navigation liquid-glass surface and control language across the open panel', async () => {
    pathname = '/calendar'
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const panel = screen.getByRole('dialog', { name: 'Workspace menu' })
    const panelGlass = screen.getByTestId('workspace-panel-glass-surface')
    const activeDestination = screen.getByRole('button', { name: 'Calendar' })

    expect(panel).toHaveClass('novo-mobile-nav-panel')
    expect(panel).not.toHaveClass('novo-focus-surface')
    expect(panelGlass).toHaveAttribute('data-glass-refractive', 'true')
    expect(panelGlass).toHaveAttribute('data-glass-preset', 'navigation')
    expect(panelGlass).toHaveAttribute('data-glass-priority', 'interactive')
    expect(panelGlass).toHaveAttribute('data-glass-active', 'true')
    expect(activeDestination).toHaveClass('novo-nav-glass-control')
    expect(activeDestination).toHaveAttribute('data-active', 'true')
    expect(panelGlass).toHaveAttribute('data-navigation-material', 'panel')
    expect(screen.getByTestId('mobile-nav-rail-glass')).toHaveAttribute('data-navigation-material', 'bar')
  })

  it('shares a selection overlay and current-page semantics on desktop', () => {
    pathname = '/cognitive'
    render(<SidebarProvider><AppSidebar /></SidebarProvider>)
    const current = screen.getByRole('link', { name: 'Cognitivo' })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.closest('[data-sidebar="menu-item"]')?.querySelector('[data-nav-selection]')).not.toBeNull()
  })

  it('keeps background navigation inert until the drawer exit finishes', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const nav = document.querySelector('nav[aria-label="Primary mobile navigation"]')
    expect(nav).toHaveAttribute('inert')

    await user.click(screen.getByTestId('workspace-backdrop'))
    expect(nav).toHaveAttribute('inert')

    finishNavigationFlight()

    await waitFor(() => expect(nav).not.toHaveAttribute('inert'))
  })

  it('keeps both lenses alive through the flight and releases presence from the spring', async () => {
    const user = userEvent.setup()
    renderMobileNav()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const panel = screen.getByRole('dialog', { name: 'Workspace menu' })
    expect(screen.getByTestId('mobile-nav-rail-glass')).toHaveAttribute('data-glass-active', 'true')
    expect(screen.getByTestId('mobile-nav-plus-glass')).toHaveAttribute('data-glass-active', 'true')
    expect(panel.querySelector('[data-liquid-panel-material]')).not.toBeNull()
    await user.click(within(panel).getByRole('button', { name: 'Close menu' }))
    expect(screen.getByTestId('workspace-panel-glass-surface')).toHaveAttribute('data-glass-active', 'true')
    expect(panel).toBeInTheDocument()
    finishNavigationFlight()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).not.toHaveAttribute('inert')
  })

  it('can reopen during the return without an old completion closing the new panel', async () => {
    const user = userEvent.setup()
    renderMobileNav()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByTestId('workspace-backdrop'))
    // The source stays inert for real users until rest; this simulates a
    // programmatic reversal while its spring is already returning.
    fireEvent.click(document.querySelector('[data-testid="mobile-nav-plus-glass"]')!.parentElement!)
    finishNavigationFlight()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not promote Workout as a critical quick action', () => {
    render(<QuickActions />)

    expect(screen.queryByText('New Routine')).not.toBeInTheDocument()
    expect(screen.queryByText('Start Workout')).not.toBeInTheDocument()
  })

})
