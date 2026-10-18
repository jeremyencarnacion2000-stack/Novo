import { liquidNeckProfile, type LiquidRect } from '@/lib/liquid-notification'

export const LIQUID_MODAL = { response: 0.5, closeResponse: 0.42, damping: 0.9, padding: 24, dropSize: 52 } as const
export const modalClamp = (n: number) => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const modalSegment = (p: number, from: number, to: number) => {
  const t = modalClamp((p - from) / (to - from))
  return t * t * (3 - 2 * t)
}

export function resolveLiquidModalSource(source: LiquidRect | null | undefined, target: LiquidRect): LiquidRect {
  if (source && source.width > 0 && source.height > 0 && Object.values(source).every(Number.isFinite)) return source
  return { left: target.left + target.width / 2 - 26, top: target.top + target.height / 2 - 26, width: 52, height: 52 }
}

export function getLiquidModalBounds(source: LiquidRect, target: LiquidRect) {
  const left = Math.min(source.left, target.left) - LIQUID_MODAL.padding
  const top = Math.min(source.top, target.top) - LIQUID_MODAL.padding
  return { left, top, width: Math.max(source.left + source.width, target.left + target.width) + LIQUID_MODAL.padding - left,
    height: Math.max(source.top + source.height, target.top + target.height) + LIQUID_MODAL.padding - top }
}

/** Reversible source → drop → full surface. Content never changes dimensions. */
export function buildLiquidModalGeometry(progress: number, source: LiquidRect, target: LiquidRect, sourceRadius: number, targetRadius: number) {
  const p = modalClamp(progress)
  const travel = modalSegment(p, 0, 0.82)
  const compact = modalSegment(p, 0, 0.22)
  const expand = modalSegment(p, 0.22, 1)
  const neck = liquidNeckProfile(p / 0.82) * (1 - modalSegment(p, 0.34, 0.7))
  const drop = Math.min(LIQUID_MODAL.dropSize, target.width, target.height)
  const width = mix(mix(source.width, drop, compact), target.width, expand)
  const height = mix(mix(source.height, drop, compact), target.height, expand)
  const centerX = mix(source.left + source.width / 2, target.left + target.width / 2, travel)
  const centerY = mix(source.top + source.height / 2, target.top + target.height / 2, travel)
  return { left: centerX - width / 2, top: centerY - height / 2, width, height,
    radius: Math.min(width / 2, height / 2, mix(mix(sourceRadius, drop / 2, compact), targetRadius, expand)),
    neck, reveal: modalSegment(p, 0.68, 0.96) }
}
