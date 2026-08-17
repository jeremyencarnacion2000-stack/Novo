import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { SettingsProvider, useSettings } from '@/lib/settings-context'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

describe('SettingsProvider material theme refresh', () => {
  it('re-resolves all inline material variables after a system-theme flip', async () => {
    let systemThemeListener: ((event: MediaQueryListEvent) => void) | undefined
    const mediaQuery = {
      matches: false,
      addEventListener: jest.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListener = listener
      }),
      removeEventListener: jest.fn(),
    }
    window.matchMedia = jest.fn().mockReturnValue(mediaQuery) as typeof window.matchMedia

    function Controls() {
      const { updateSettings } = useSettings()

      return (
        <button onClick={() => updateSettings({
          theme: 'system',
          glassOpacity: 40,
          cardOpacity: 50,
          glassBlur: 3,
          cardLiquidIntensity: 6,
        })}>
          Use system theme
        </button>
      )
    }

    render(
      <SettingsProvider>
        <Controls />
      </SettingsProvider>,
    )

    fireEvent.click(document.querySelector('button')!)

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--novo-context-background')).toBe(
        'rgba(255, 255, 255, 0.4)',
      )
      expect(document.documentElement.style.getPropertyValue('--glass-blur-px')).toBe('3px')
      expect(document.documentElement.style.getPropertyValue('--card-blur-px')).toBe('6px')
    })

    act(() => systemThemeListener?.({ matches: true } as MediaQueryListEvent))

    expect(document.documentElement.classList).toContain('dark')
    expect(document.documentElement.style.getPropertyValue('--novo-context-background')).toBe(
      'rgba(255, 255, 255, 0.4)',
    )
    expect(document.documentElement.style.getPropertyValue('--novo-focus-background')).toBe(
      'rgba(255, 255, 255, 0.5)',
    )
  })
})
