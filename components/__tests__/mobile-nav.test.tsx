import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import fs from 'node:fs'
import path from 'node:path'
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
  GlassSurface: () => <div data-testid="glass-surface" />,
}))

function renderMobileNav() {
  return render(
    <MobileOverlayProvider>
      <MobileNav />
    </MobileOverlayProvider>,
  )
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

  it('keeps the shared-element nav origin mounted while the workspace menu is open', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(document.querySelector('[data-flip-from="mobile-nav-panel"]')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()
  })

  it('does not promote Workout as a critical quick action', () => {
    render(<QuickActions />)

    expect(screen.queryByText('New Routine')).not.toBeInTheDocument()
    expect(screen.queryByText('Start Workout')).not.toBeInTheDocument()
  })

  it('uses Focus Surface without the legacy drawer blur override', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components', 'mobile-section-drawer.tsx'), 'utf8')

    expect(source).toContain('novo-focus-surface')
    expect(source).not.toContain('glass-blur-xl')
  })
})
