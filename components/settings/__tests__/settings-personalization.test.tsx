import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SettingsPersonalization } from '@/components/settings/settings-personalization'
import { SettingsProvider, useSettings } from '@/lib/settings-context'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function WallpaperSelector() {
  const { updateSettings } = useSettings()

  return (
    <button onClick={() => updateSettings({ backgroundImage: '/wallpapers/bright.jpg' })}>
      Select bright wallpaper
    </button>
  )
}

describe('SettingsPersonalization material preview', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn()
    HTMLElement.prototype.getAnimations = jest.fn(() => [])
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as typeof window.matchMedia
    global.ResizeObserver = TestResizeObserver as typeof ResizeObserver
    document.documentElement.removeAttribute('style')
    document.documentElement.classList.remove('dark')
  })

  it('renders the shared material roles over the selected wallpaper and updates them on card slider input', async () => {
    render(
      <SettingsProvider>
        <WallpaperSelector />
        <SettingsPersonalization />
      </SettingsProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select bright wallpaper' }))

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--novo-canvas-background')).toContain('/wallpapers/bright.jpg')
    })

    const preview = screen.getByTestId('material-preview')
    expect(preview.style.background).toContain('/wallpapers/bright.jpg')
    expect(preview.querySelector('canvas')).toBeNull()
    expect(preview.querySelector('img')).toBeNull()
    expect(within(preview).getByTestId('preview-context-glass')).toHaveClass('novo-context-glass')
    // Focus preview uses the restored shared Card hierarchy; the deprecated
    // global focus-surface class must not be required by this surface.
    expect(within(preview).getByTestId('preview-focus-card')).toHaveClass('glass-surface')

    fireEvent.input(screen.getByLabelText('Dashboard Card Glass Opacity'), { target: { value: '90' } })

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--novo-focus-background')).toBe('rgba(255, 255, 255, 0.9)')
    })

    fireEvent.input(screen.getByLabelText('Dashboard Card Refraction Blur'), { target: { value: '32' } })

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--novo-focus-backdrop-filter')).toBe(
        'blur(32px) saturate(160%) brightness(1.04)',
      )
    })
  })

  it('applies accessibility choices globally and exposes labelled controls', async () => {
    render(
      <SettingsProvider>
        <SettingsPersonalization />
      </SettingsProvider>,
    )

    const contrast = screen.getByLabelText('High contrast')
    const transparency = screen.getByLabelText('Reduce transparency')
    expect(contrast).toBeInTheDocument()
    expect(transparency).toBeInTheDocument()

    fireEvent.click(contrast)
    fireEvent.click(transparency)
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-accessibility-high-contrast', 'true')
      expect(document.documentElement).toHaveAttribute('data-accessibility-reduce-glass', 'true')
    })

    const textSize = screen.getByRole('combobox', { name: 'Text size' })
    fireEvent.click(textSize)
    fireEvent.click(await screen.findByRole('option', { name: 'Large' }))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-accessibility-text-scale', 'large'))
  })
})
