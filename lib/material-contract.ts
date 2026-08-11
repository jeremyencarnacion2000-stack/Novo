export interface MaterialContractInput {
  theme: 'light' | 'dark'
  backgroundImage?: string
  backgroundDimness: number
  backgroundBlur: number
  autoContrast: boolean
  glassOpacity: number
  glassBlur: number
  cardOpacity: number
  cardLiquidIntensity: number
}

export interface MaterialSurface {
  background: string
  backdropFilter: string
  border: string
  boxShadow: string
}

export interface MaterialContract {
  canvas: MaterialSurface
  contextGlass: MaterialSurface
  focusSurface: MaterialSurface
  diagnostics: {
    criticalTextContrast: number
    boundaryContrast: number
  }
}

interface ThemeTokens {
  surfaceHex: string
  surfaceRgb: readonly [number, number, number]
  criticalTextHex: string
  boundaryHex: string
  contextWallpaperAlpha: number
  focusWallpaperAlpha: number
  autoContrastDimness: number
  contextShadow: string
  focusShadow: string
}

const THEME_TOKENS: Record<MaterialContractInput['theme'], ThemeTokens> = {
  light: {
    surfaceHex: '#ffffff',
    surfaceRgb: [255, 255, 255],
    criticalTextHex: '#09090b',
    boundaryHex: '#767676',
    contextWallpaperAlpha: 0.68,
    focusWallpaperAlpha: 0.78,
    autoContrastDimness: 0.35,
    contextShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 8px 28px rgba(15, 23, 42, 0.14)',
    focusShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 12px 36px rgba(15, 23, 42, 0.18)',
  },
  dark: {
    surfaceHex: '#0a0e14',
    surfaceRgb: [10, 14, 20],
    criticalTextHex: '#fafafa',
    boundaryHex: '#737a84',
    contextWallpaperAlpha: 0.56,
    focusWallpaperAlpha: 0.68,
    autoContrastDimness: 0.55,
    contextShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 12px 34px rgba(0, 0, 0, 0.34)',
    focusShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 16px 48px rgba(0, 0, 0, 0.42)',
  },
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function alphaFromPercentage(value: number): number {
  return clamp(value, 0, 100) / 100
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function rgba([red, green, blue]: readonly [number, number, number], alpha: number): string {
  return `rgba(${red}, ${green}, ${blue}, ${formatNumber(alpha)})`
}

function escapeCssUrl(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, '')
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Expected a six-digit hex RGB token, received: ${hex}`)
  }

  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ))

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(firstHex)
  const second = relativeLuminance(secondHex)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

export function resolveMaterialContract(input: MaterialContractInput): MaterialContract {
  const tokens = THEME_TOKENS[input.theme]
  const wallpaper = input.backgroundImage?.trim() ?? ''
  const hasWallpaper = wallpaper.length > 0
  const requestedDimness = alphaFromPercentage(input.backgroundDimness)
  const canvasDimness = hasWallpaper && input.autoContrast
    ? Math.max(requestedDimness, tokens.autoContrastDimness)
    : requestedDimness
  const requestedCanvasBlur = clamp(input.backgroundBlur, 0, 100)
  const canvasBlur = hasWallpaper && input.autoContrast
    ? Math.max(requestedCanvasBlur, 10)
    : requestedCanvasBlur

  const requestedContextAlpha = alphaFromPercentage(input.glassOpacity)
  const requestedFocusAlpha = alphaFromPercentage(input.cardOpacity)
  const contextAlpha = hasWallpaper
    ? Math.max(requestedContextAlpha, tokens.contextWallpaperAlpha)
    : requestedContextAlpha
  const focusAlpha = hasWallpaper
    ? Math.max(requestedFocusAlpha, tokens.focusWallpaperAlpha)
    : requestedFocusAlpha
  const contextBlur = hasWallpaper
    ? Math.max(clamp(input.glassBlur, 0, 100), 12)
    : clamp(input.glassBlur, 0, 100)
  const focusBlur = hasWallpaper
    ? Math.max(clamp(input.cardLiquidIntensity, 0, 100), 18)
    : clamp(input.cardLiquidIntensity, 0, 100)

  const boundary = `1px solid ${tokens.boundaryHex}`
  const canvasBackground = hasWallpaper
    ? `linear-gradient(${rgba([0, 0, 0], canvasDimness)}, ${rgba([0, 0, 0], canvasDimness)}), url("${escapeCssUrl(wallpaper)}")`
    : tokens.surfaceHex

  const canvas: MaterialSurface = {
    background: canvasBackground,
    backdropFilter: `blur(${formatNumber(canvasBlur)}px)`,
    border: '1px solid transparent',
    boxShadow: 'none',
  }
  const contextGlass: MaterialSurface = {
    background: rgba(tokens.surfaceRgb, contextAlpha),
    backdropFilter: `blur(${formatNumber(contextBlur)}px) saturate(160%) brightness(1.04)`,
    border: boundary,
    boxShadow: tokens.contextShadow,
  }
  const focusSurface: MaterialSurface = {
    background: rgba(tokens.surfaceRgb, focusAlpha),
    backdropFilter: `blur(${formatNumber(focusBlur)}px) saturate(160%) brightness(1.04)`,
    border: boundary,
    boxShadow: tokens.focusShadow,
  }

  return {
    canvas,
    contextGlass,
    focusSurface,
    diagnostics: {
      // These are token-pair diagnostics. Arbitrary wallpaper pixels are not
      // sampled or guessed; local fill and blur floors protect those cases.
      criticalTextContrast: contrastRatio(tokens.criticalTextHex, tokens.surfaceHex),
      boundaryContrast: contrastRatio(tokens.boundaryHex, tokens.surfaceHex),
    },
  }
}
