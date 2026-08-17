import { resolveMaterialContract, type MaterialContractInput } from '@/lib/material-contract'

const baseInput: MaterialContractInput = {
  theme: 'light',
  backgroundImage: '',
  backgroundDimness: 15,
  backgroundBlur: 0,
  autoContrast: false,
  glassOpacity: 12,
  glassBlur: 8,
  cardOpacity: 15,
  cardLiquidIntensity: 10,
}

describe('resolveMaterialContract', () => {
  it.each([
    ['dark wallpaper with dark theme', { backgroundImage: '/wallpapers/dark.jpg', theme: 'dark' as const }],
    ['bright wallpaper with light theme', { backgroundImage: '/wallpapers/bright.jpg', theme: 'light' as const }],
    ['high-detail wallpaper with light theme', { backgroundImage: '/wallpapers/high-detail.jpg', theme: 'light' as const }],
    ['no wallpaper with light theme', { backgroundImage: '', theme: 'light' as const }],
    ['no wallpaper with dark theme', { backgroundImage: '', theme: 'dark' as const }],
  ])('keeps critical text and material boundaries legible for %s', (_label, overrides) => {
    const contract = resolveMaterialContract({ ...baseInput, ...overrides })

    expect(contract.diagnostics.criticalTextContrast).toBeGreaterThanOrEqual(4.5)
    expect(contract.diagnostics.boundaryContrast).toBeGreaterThanOrEqual(3)
    expect(contract.focusSurface.background).not.toMatch(/^transparent$/)
    expect(contract.contextGlass.background).not.toMatch(/^transparent$/)
    expect(contract.focusSurface.backdropFilter).toContain('blur(')
  })

  it.each([
    ['light', 'rgba(255, 255, 255, 0.68)', 'rgba(255, 255, 255, 0.78)'],
    ['dark', 'rgba(255, 255, 255, 0.56)', 'rgba(255, 255, 255, 0.68)'],
  ] as const)(
    'prevents zero opacity and blur settings from making %s wallpaper materials transparent',
    (theme, expectedContextFill, expectedFocusFill) => {
      const contract = resolveMaterialContract({
        ...baseInput,
        theme,
        backgroundImage: '/wallpapers/arbitrary.jpg',
        autoContrast: true,
        glassOpacity: 0,
        glassBlur: 0,
        cardOpacity: 0,
        cardLiquidIntensity: 0,
      })

      expect(contract.contextGlass.background).toBe(expectedContextFill)
      expect(contract.contextGlass.backdropFilter).toContain('blur(12px)')
      expect(contract.focusSurface.background).toBe(expectedFocusFill)
      expect(contract.focusSurface.backdropFilter).toContain('blur(18px)')
    },
  )

  it('adds canvas protection when auto contrast is enabled without replacing local surface floors', () => {
    const contract = resolveMaterialContract({
      ...baseInput,
      backgroundImage: '/wallpapers/bright.jpg',
      backgroundDimness: 0,
      backgroundBlur: 0,
      autoContrast: true,
      glassOpacity: 0,
      glassBlur: 0,
      cardOpacity: 0,
      cardLiquidIntensity: 0,
    })

    expect(contract.canvas.background).toContain('rgba(0, 0, 0, 0.35)')
    expect(contract.canvas.backdropFilter).toBe('blur(10px)')
    expect(contract.contextGlass.backdropFilter).toContain('blur(12px)')
    expect(contract.focusSurface.backdropFilter).toContain('blur(18px)')
  })

  it('preserves the requested flat-canvas opacity and blur without adding visual floors', () => {
    const contract = resolveMaterialContract(baseInput)

    expect(contract.contextGlass.background).toBe('rgba(255, 255, 255, 0.12)')
    expect(contract.contextGlass.backdropFilter).toContain('blur(8px)')
    expect(contract.contextGlass.border).toBe('1px solid transparent')
    expect(contract.focusSurface.background).toBe('rgba(255, 255, 255, 0.15)')
    expect(contract.focusSurface.backdropFilter).toContain('blur(10px)')
    expect(contract.focusSurface.border).toBe('1px solid transparent')
  })

  it('uses quiet optical edges instead of accessibility-token outlines in dark mode', () => {
    const contract = resolveMaterialContract({ ...baseInput, theme: 'dark' })

    expect(contract.contextGlass.border).toBe('1px solid transparent')
    expect(contract.focusSurface.border).toBe('1px solid transparent')
  })

  it('keeps dark wallpaper cards neutral and honors the requested opacity and blur', () => {
    const contract = resolveMaterialContract({
      ...baseInput,
      theme: 'dark',
      backgroundImage: '/wallpapers/arbitrary.jpg',
      autoContrast: false,
      glassOpacity: 7,
      glassBlur: 3,
      cardOpacity: 11,
      cardLiquidIntensity: 6,
    })

    expect(contract.contextGlass.background).toBe('rgba(255, 255, 255, 0.07)')
    expect(contract.contextGlass.backdropFilter).toContain('blur(3px)')
    expect(contract.focusSurface.background).toBe('rgba(255, 255, 255, 0.11)')
    expect(contract.focusSurface.backdropFilter).toContain('blur(6px)')
    expect(contract.focusSurface.background).not.toContain('10, 14, 20')
  })
})
