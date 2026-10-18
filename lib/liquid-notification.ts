// Web adaptation of rit3zh/expo-dynamic-notifications (MIT).
// See THIRD-PARTY-NOTICES.md for the original license and source revision.
export const LIQUID_NOTICE = {
  gap: 34, dropSize: 52, neckWidth: 60,
  blur: 14.3, gain: 22, threshold: 0.43,
  enter: { expand: 340, reveal: 560 },
  exit: { collapse: 100, drop: 280 },
  springs: {
    drop: { type: 'spring', duration: 1.15, bounce: 0.18 },
    expand: { type: 'spring', duration: 1, bounce: 0.2 },
    reveal: { type: 'spring', duration: 0.7, bounce: 0 },
    collapse: { type: 'spring', duration: 0.66, bounce: 0.08 },
    return: { type: 'spring', duration: 1.15, bounce: 0.1 },
    fade: { type: 'spring', duration: 0.36, bounce: 0 },
  },
} as const

export const LIQUID_SURFACE = { openResponse: 0.5, closeResponse: 0.46, damping: 0.82 } as const
export type LiquidRect = { left: number; top: number; width: number; height: number }
export type LiquidNoticeLayout = {
  source: LiquidRect; card: LiquidRect; side: 'below' | 'left'
}
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))
const mix = (from: number, to: number, p: number) => from + (to - from) * p

export function liquidNeckProfile(progress: number) {
  const t = clamp(progress)
  if (t <= 0 || t >= 1) return 0
  const peak = 1.6 / 3
  return (t ** 1.6 * (1 - t) ** 1.4) / (peak ** 1.6 * (1 - peak) ** 1.4)
}

export function getLiquidNoticeLayout(
  source: LiquidRect,
  viewport: { width: number; height: number },
  preferredSide: 'below' | 'left',
  height = 104,
): LiquidNoticeLayout {
  const margin = 16
  const side = preferredSide === 'left' && viewport.width >= 560 && source.left - LIQUID_NOTICE.gap - margin >= 220 ? 'left' : 'below'
  const width = Math.min(396, Math.max(1, viewport.width - margin * 2), side === 'left' ? source.left - LIQUID_NOTICE.gap - margin : Infinity)
  const cardHeight = Math.min(Math.max(74, height), Math.max(1, viewport.height - margin * 2))
  const left = side === 'left'
    ? source.left - LIQUID_NOTICE.gap - width
    : clamp(source.left + source.width / 2 - width / 2, margin, Math.max(margin, viewport.width - width - margin))
  const top = clamp(side === 'left' ? source.top + (source.height - cardHeight) / 2 : source.top + source.height + LIQUID_NOTICE.gap,
    margin, Math.max(margin, viewport.height - cardHeight - margin))
  return { source, side, card: { left, top, width, height: cardHeight } }
}

/** Same grow / stretch / neck geometry as the reference; horizontal travel is Novo's Hub adaptation. */
export function buildLiquidNoticeGeometry(drop: number, expand: number, layout: LiquidNoticeLayout) {
  const { source, card, side } = layout
  const grow = 1 - (1 - clamp(drop / 0.7)) ** 1.25
  const neck = liquidNeckProfile(drop / 0.82)
  const stretch = 1 + 0.38 * neck
  const droplet = LIQUID_NOTICE.dropSize * grow
  const width = Math.max(0, mix(side === 'left' ? droplet * stretch : droplet / stretch, card.width, expand))
  const height = Math.max(0, mix(side === 'left' ? droplet / stretch : droplet * stretch, card.height, expand))
  const sourceX = source.left + source.width * (side === 'left' ? 0.34 : 0.5)
  const sourceY = source.top + source.height * (side === 'left' ? 0.5 : 0.66)
  const centerX = mix(sourceX, card.left + card.width / 2, drop)
  const centerY = mix(sourceY, card.top + card.height / 2, drop)
  return {
    x: centerX - width / 2, y: centerY - height / 2, width, height,
    radius: Math.max(0, Math.min(mix(droplet / 2, 28, expand), width / 2, height / 2)),
    sourceX, sourceY, centerX, centerY,
    neckWidth: Math.min(LIQUID_NOTICE.neckWidth, side === 'left' ? height : width) * neck,
    offsetX: centerX - card.left - card.width / 2,
    offsetY: centerY - card.top - card.height / 2,
  }
}
