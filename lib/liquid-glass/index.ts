/**
 * Novo Liquid Glass — Public API barrel
 *
 * import { GlassSurface } from '@/lib/liquid-glass'
 * import { getDisplacementMap, getDisplacementFilter } from '@/lib/liquid-glass'
 * import { useLiquidGlass } from '@/lib/liquid-glass'
 */

export { GlassSurface } from '@/components/ui/GlassSurface'
export type { GlassSurfaceProps } from '@/components/ui/GlassSurface'

export { useLiquidGlass } from './useLiquidGlass'
export type { UseLiquidGlassOptions, UseLiquidGlassResult } from './useLiquidGlass'

export { getDisplacementMap, getDisplacementFilter } from './displacement-utils'
export type { DisplacementMapParams, DisplacementFilterParams } from './displacement-utils'
