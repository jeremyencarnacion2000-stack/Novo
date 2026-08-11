import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { MobileNav } from '../mobile-nav'
import { MobileOverlayProvider } from '../mobile-overlay-provider'

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
    }[key] ?? key),
  }),
}))

jest.mock('@/hooks/use-modal-flip', () => ({
  useModalFlip: () => (done: () => void) => done(),
}))

jest.mock('@/components/ui/GlassSurface', () => ({
  GlassSurface: () => <div data-testid="glass-surface" />,
}))

jest.mock('@/components/mobile-section-drawer', () => ({
  MobileSectionDrawer: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Workspace menu">
      <button onClick={onClose}>Cerrar workspace</button>
    </div>
  ),
}))

function renderMobileNav() {
  return render(
    <MobileOverlayProvider>
      <MobileNav />
    </MobileOverlayProvider>,
  )
}

describe('MobileNav', () => {
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

  it('opens a secondary workspace layer without adding more primary destinations', async () => {
    const user = userEvent.setup()
    renderMobileNav()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Workspace menu' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('uses Focus Surface without the legacy drawer blur override', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components', 'mobile-section-drawer.tsx'), 'utf8')

    expect(source).toContain('novo-focus-surface')
    expect(source).not.toContain('glass-blur-xl')
  })
})
