import { Spring, clamp } from '@/lib/hub-surface-motion'

export type LiquidNavigationMode = 'full' | 'reduced' | 'off'

export type LiquidNavigationRect = {
  left: number
  top: number
  width: number
  height: number
}

export type LiquidNavigationFrame = {
  rect: LiquidNavigationRect
  radius: number
  direction: { x: number; y: number }
  velocity: { x: number; y: number }
  speed: number
  progress: number
  energy: number
  anticipation: number
  trailOpacity: number
  settled: boolean
}

/** Single source of truth for the primary navigation's liquid material. */
export const NAV_LIQUID_MOTION = {
  spring: {
    response: 0.3,
    launchResponse: 0.76,
    cruiseResponse: 0.88,
    settleResponse: 1.02,
    launchDamping: 0.91,
    cruiseDamping: 0.945,
    settleDamping: 0.987,
    leadingEdgeResponse: 0.76,
    trailingEdgeResponse: 1.12,
    reducedResponse: 0.16,
    reducedDamping: 1,
    maxFrameDelta: 1 / 24,
    settledPosition: 0.35,
    settledVelocity: 2.5,
    minimumTravel: 0.5,
    phase: {
      launchStart: 0.1,
      launchEnd: 0.3,
      settleStart: 0.7,
      settleEnd: 0.96,
    },
  },
  deformation: {
    positionFilter: 18,
    speedFilter: 14,
    speedForFullEnergy: 1500,
    gateExponent: 1.12,
    leadingEdgeOffset: 5,
    trailingEdgeOffset: 2.5,
    verticalEdgeOffset: 3,
    intentDuration: 0.055,
    intentScaleX: 0.97,
    intentScaleY: 1.02,
    cornerSegments: 8,
    curveEdgeThreshold: 0.02,
    targetEqualityTolerance: 0.1,
    minimumDimension: 1,
    defaultRadius: 22,
  },
  trail: {
    historyLength: 6,
    sampleHz: 41,
    speedThreshold: 180,
    fullOpacitySpeed: 900,
    firstOpacity: 0.04,
    secondOpacity: 0.022,
  },
  specular: {
    velocityFactor: 0.018,
    maxOffset: 8,
    baseOpacity: 0.12,
    motionOpacity: 0.09,
  },
} as const

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

const centerX = (rect: LiquidNavigationRect) => rect.left + rect.width / 2
const centerY = (rect: LiquidNavigationRect) => rect.top + rect.height / 2

const makeSpring = (value = 0) => new Spring(value, NAV_LIQUID_MOTION.spring.response, 0.945)

export class LiquidNavigationMotion {
  private readonly left = makeSpring()
  private readonly right = makeSpring()
  private readonly top = makeSpring()
  private readonly bottom = makeSpring()
  private readonly radius = makeSpring()
  private initialized = false
  private target: LiquidNavigationRect = { left: 0, top: 0, width: 0, height: 0 }
  private targetRadius = 0
  private startCenter = { x: 0, y: 0 }
  private travelDistance = { x: 0, y: 0 }
  private direction = { x: 0, y: 0 }
  private elapsed = 0
  private filteredVelocity = { x: 0, y: 0 }
  private filteredSpeed = 0
  private currentMode: LiquidNavigationMode = 'full'

  get currentRect(): LiquidNavigationRect {
    if (!this.initialized) return this.target
    const left = this.left.value
    const right = this.right.value
    const top = this.top.value
    const bottom = this.bottom.value
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    }
  }

  get velocity() {
    return { ...this.filteredVelocity }
  }

  get settled() {
    return !this.initialized || this.isSettled()
  }

  readFrame() {
    return this.frame(this.progress(), undefined, this.settled)
  }

  retarget(rect: LiquidNavigationRect, mode: LiquidNavigationMode = 'full', radius?: number) {
    const next = {
      left: rect.left,
      top: rect.top,
      width: Math.max(NAV_LIQUID_MOTION.deformation.minimumDimension, rect.width),
      height: Math.max(NAV_LIQUID_MOTION.deformation.minimumDimension, rect.height),
    }
    const nextRadius = clamp(radius ?? Math.min(next.height / 2, NAV_LIQUID_MOTION.deformation.defaultRadius), 0, Math.min(next.width, next.height) / 2)
    const previousMode = this.currentMode
    const sameTarget = this.initialized
      && Math.abs(this.target.left - next.left) < NAV_LIQUID_MOTION.deformation.targetEqualityTolerance
      && Math.abs(this.target.top - next.top) < NAV_LIQUID_MOTION.deformation.targetEqualityTolerance
      && Math.abs(this.target.width - next.width) < NAV_LIQUID_MOTION.deformation.targetEqualityTolerance
      && Math.abs(this.target.height - next.height) < NAV_LIQUID_MOTION.deformation.targetEqualityTolerance
      && Math.abs(this.targetRadius - nextRadius) < NAV_LIQUID_MOTION.deformation.targetEqualityTolerance

    this.currentMode = mode
    if (sameTarget && mode !== 'off') {
      if (mode === 'reduced' && previousMode !== 'reduced') this.clearVelocity()
      return
    }

    if (!this.initialized || mode === 'off') {
      this.snapTo(next, nextRadius)
      return
    }

    const from = this.currentRect
    this.startCenter = { x: centerX(from), y: centerY(from) }
    const dx = centerX(next) - this.startCenter.x
    const dy = centerY(next) - this.startCenter.y
    this.travelDistance = { x: Math.abs(dx), y: Math.abs(dy) }
    this.direction = { x: Math.sign(dx), y: Math.sign(dy) }
    this.target = next
    this.targetRadius = nextRadius
    this.left.target = next.left
    this.right.target = next.left + next.width
    this.top.target = next.top
    this.bottom.target = next.top + next.height
    this.radius.target = nextRadius
    this.elapsed = 0

    // Reduced motion keeps the same contextual surface but removes stored
    // kinetic energy, deformation, trails, and the specular run.
    if (mode === 'reduced') this.clearVelocity()
  }

  step(realDelta: number, mode: LiquidNavigationMode = this.currentMode): LiquidNavigationFrame {
    this.currentMode = mode
    if (!this.initialized) return this.frame(0, 0, true)
    if (mode === 'off') {
      this.snapTo(this.target, this.targetRadius)
      return this.frame(1, 0, true)
    }

    const dt = clamp(realDelta, 0, NAV_LIQUID_MOTION.spring.maxFrameDelta)
    if (dt <= 0) return this.frame(this.progress(), 0, false)

    const progressBeforeStep = this.progress()
    if (mode === 'reduced') {
      this.configureAll(NAV_LIQUID_MOTION.spring.reducedResponse, NAV_LIQUID_MOTION.spring.reducedDamping)
    } else {
      const launch = 1 - smoothstep(
        NAV_LIQUID_MOTION.spring.phase.launchStart,
        NAV_LIQUID_MOTION.spring.phase.launchEnd,
        progressBeforeStep,
      )
      const settle = smoothstep(
        NAV_LIQUID_MOTION.spring.phase.settleStart,
        NAV_LIQUID_MOTION.spring.phase.settleEnd,
        progressBeforeStep,
      )
      const cruise = clamp(1 - launch - settle, 0, 1)
      const responseScale = launch * NAV_LIQUID_MOTION.spring.launchResponse
        + cruise * NAV_LIQUID_MOTION.spring.cruiseResponse
        + settle * NAV_LIQUID_MOTION.spring.settleResponse
      const damping = launch * NAV_LIQUID_MOTION.spring.launchDamping
        + cruise * NAV_LIQUID_MOTION.spring.cruiseDamping
        + settle * NAV_LIQUID_MOTION.spring.settleDamping
      const response = NAV_LIQUID_MOTION.spring.response * responseScale
      this.configureDirectional(response, damping)
    }

    this.left.step(dt)
    this.right.step(dt)
    this.top.step(dt)
    this.bottom.step(dt)
    this.radius.step(dt)
    this.elapsed += dt

    const rawVelocityX = (this.left.velocity + this.right.velocity) / 2
    const rawVelocityY = (this.top.velocity + this.bottom.velocity) / 2
    const positionAlpha = 1 - Math.exp(-dt * NAV_LIQUID_MOTION.deformation.positionFilter)
    this.filteredVelocity.x += (rawVelocityX - this.filteredVelocity.x) * positionAlpha
    this.filteredVelocity.y += (rawVelocityY - this.filteredVelocity.y) * positionAlpha
    const rawSpeed = Math.hypot(this.filteredVelocity.x, this.filteredVelocity.y)
    const speedAlpha = 1 - Math.exp(-dt * NAV_LIQUID_MOTION.deformation.speedFilter)
    this.filteredSpeed += (rawSpeed - this.filteredSpeed) * speedAlpha

    const settled = this.isSettled()
    if (settled) this.snapTo(this.target, this.targetRadius)
    return this.frame(settled ? 1 : this.progress(), mode === 'full' ? undefined : 0, settled)
  }

  private frame(progress: number, forcedEnergy?: number, settled = false): LiquidNavigationFrame {
    const raw = this.currentRect
    const fullMotion = this.currentMode === 'full' && !settled
    const gate = Math.pow(Math.max(0, Math.sin(Math.PI * clamp(progress, 0, 1))), NAV_LIQUID_MOTION.deformation.gateExponent)
    const energy = forcedEnergy ?? (fullMotion
      ? clamp(this.filteredSpeed / NAV_LIQUID_MOTION.deformation.speedForFullEnergy, 0, 1) * gate
      : 0)

    let left = raw.left
    let right = raw.left + raw.width
    let top = raw.top
    let bottom = raw.top + raw.height
    if (energy > 0) {
      if (this.direction.x > 0) {
        left -= energy * NAV_LIQUID_MOTION.deformation.trailingEdgeOffset
        right += energy * NAV_LIQUID_MOTION.deformation.leadingEdgeOffset
      } else if (this.direction.x < 0) {
        left -= energy * NAV_LIQUID_MOTION.deformation.leadingEdgeOffset
        right += energy * NAV_LIQUID_MOTION.deformation.trailingEdgeOffset
      }
      if (this.direction.y > 0) {
        top -= energy * NAV_LIQUID_MOTION.deformation.trailingEdgeOffset
        bottom += energy * NAV_LIQUID_MOTION.deformation.verticalEdgeOffset
      } else if (this.direction.y < 0) {
        top -= energy * NAV_LIQUID_MOTION.deformation.verticalEdgeOffset
        bottom += energy * NAV_LIQUID_MOTION.deformation.trailingEdgeOffset
      }
    }

    const anticipation = fullMotion
      ? 1 - smoothstep(0, NAV_LIQUID_MOTION.deformation.intentDuration, this.elapsed)
      : 0
    if (anticipation > 0) {
      const cx = (left + right) / 2
      const cy = (top + bottom) / 2
      const width = (right - left) * (1 - (1 - NAV_LIQUID_MOTION.deformation.intentScaleX) * anticipation)
      const height = (bottom - top) * (1 + (NAV_LIQUID_MOTION.deformation.intentScaleY - 1) * anticipation)
      left = cx - width / 2
      right = cx + width / 2
      top = cy - height / 2
      bottom = cy + height / 2
    }

    const trailProgress = clamp(
      (this.filteredSpeed - NAV_LIQUID_MOTION.trail.speedThreshold) / Math.max(1, NAV_LIQUID_MOTION.trail.fullOpacitySpeed - NAV_LIQUID_MOTION.trail.speedThreshold),
      0,
      1,
    )
    const trailOpacity = fullMotion ? trailProgress * NAV_LIQUID_MOTION.trail.firstOpacity : 0

    return {
      rect: { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
      radius: clamp(this.radius.value + energy * 0.6, 0, Math.min(right - left, bottom - top) / 2),
      direction: { ...this.direction },
      velocity: { ...this.filteredVelocity },
      speed: this.filteredSpeed,
      progress: clamp(progress, 0, 1),
      energy,
      anticipation,
      trailOpacity,
      settled,
    }
  }

  private progress() {
    const current = this.currentRect
    const dx = this.travelDistance.x > NAV_LIQUID_MOTION.spring.minimumTravel
      ? 1 - Math.abs(centerX(this.target) - centerX(current)) / this.travelDistance.x
      : 1
    const dy = this.travelDistance.y > NAV_LIQUID_MOTION.spring.minimumTravel
      ? 1 - Math.abs(centerY(this.target) - centerY(current)) / this.travelDistance.y
      : 1
    const progressX = this.direction.x === 0 ? 0 : dx
    const progressY = this.direction.y === 0 ? 0 : dy
    if (this.direction.x !== 0 && this.direction.y !== 0) return clamp((progressX + progressY) / 2, 0, 1)
    return clamp(this.direction.x !== 0 ? progressX : progressY, 0, 1)
  }

  private configureAll(response: number, damping: number) {
    for (const spring of [this.left, this.right, this.top, this.bottom, this.radius]) spring.configure(response, damping)
  }

  private configureDirectional(response: number, damping: number) {
    const leading = NAV_LIQUID_MOTION.spring.leadingEdgeResponse
    const trailing = NAV_LIQUID_MOTION.spring.trailingEdgeResponse
    const horizontal = this.direction.x > 0
      ? { left: trailing, right: leading }
      : this.direction.x < 0
        ? { left: leading, right: trailing }
        : { left: 1, right: 1 }
    const vertical = this.direction.y > 0
      ? { top: trailing, bottom: leading }
      : this.direction.y < 0
        ? { top: leading, bottom: trailing }
        : { top: 1, bottom: 1 }
    this.left.configure(response * horizontal.left, damping)
    this.right.configure(response * horizontal.right, damping)
    this.top.configure(response * vertical.top, damping)
    this.bottom.configure(response * vertical.bottom, damping)
    this.radius.configure(response, damping)
  }

  private isSettled() {
    const { settledPosition, settledVelocity } = NAV_LIQUID_MOTION.spring
    return Math.abs(this.left.target - this.left.value) < settledPosition
      && Math.abs(this.right.target - this.right.value) < settledPosition
      && Math.abs(this.top.target - this.top.value) < settledPosition
      && Math.abs(this.bottom.target - this.bottom.value) < settledPosition
      && Math.abs(this.radius.target - this.radius.value) < settledPosition
      && Math.abs(this.left.velocity) < settledVelocity
      && Math.abs(this.right.velocity) < settledVelocity
      && Math.abs(this.top.velocity) < settledVelocity
      && Math.abs(this.bottom.velocity) < settledVelocity
      && Math.abs(this.radius.velocity) < settledVelocity
  }

  private clearVelocity() {
    for (const spring of [this.left, this.right, this.top, this.bottom, this.radius]) spring.velocity = 0
    this.filteredVelocity = { x: 0, y: 0 }
    this.filteredSpeed = 0
  }

  private snapTo(rect: LiquidNavigationRect, radius: number) {
    this.target = rect
    this.targetRadius = radius
    this.left.set(rect.left)
    this.right.set(rect.left + rect.width)
    this.top.set(rect.top)
    this.bottom.set(rect.top + rect.height)
    this.radius.set(radius)
    this.startCenter = { x: centerX(rect), y: centerY(rect) }
    this.travelDistance = { x: 0, y: 0 }
    this.direction = { x: 0, y: 0 }
    this.elapsed = 0
    this.clearVelocity()
    this.initialized = true
  }
}

function arcSegment(cx: number, cy: number, radius: number, start: number, end: number) {
  const delta = end - start
  const handle = (4 / 3) * Math.tan(delta / 4) * radius
  const startX = cx + Math.cos(start) * radius
  const startY = cy + Math.sin(start) * radius
  const endX = cx + Math.cos(end) * radius
  const endY = cy + Math.sin(end) * radius
  const control1X = startX - Math.sin(start) * handle
  const control1Y = startY + Math.cos(start) * handle
  const control2X = endX + Math.sin(end) * handle
  const control2Y = endY - Math.cos(end) * handle
  return `C ${control1X.toFixed(2)} ${control1Y.toFixed(2)} ${control2X.toFixed(2)} ${control2Y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`
}

function roundedCorner(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const segments = NAV_LIQUID_MOTION.deformation.cornerSegments
  return Array.from({ length: segments }, (_, index) => {
    const start = startAngle + ((endAngle - startAngle) * index) / segments
    const end = startAngle + ((endAngle - startAngle) * (index + 1)) / segments
    return arcSegment(cx, cy, radius, start, end)
  }).join(' ')
}

function curvedEdge(start: number, end: number, base: number, bulge: number, horizontal: boolean) {
  if (Math.abs(bulge) < NAV_LIQUID_MOTION.deformation.curveEdgeThreshold) {
    return horizontal ? `L ${end.toFixed(2)} ${base.toFixed(2)}` : `L ${base.toFixed(2)} ${end.toFixed(2)}`
  }
  const middle = (start + end) / 2
  const quarter = Math.abs(end - start) * 0.25
  const point = (along: number, across: number) => horizontal
    ? `${along.toFixed(2)} ${across.toFixed(2)}`
    : `${across.toFixed(2)} ${along.toFixed(2)}`
  return `C ${point(start + quarter, base + bulge * 0.34)} ${point(middle, base + bulge)} ${point(middle, base + bulge)} C ${point(middle, base + bulge)} ${point(end - quarter, base + bulge * 0.34)} ${point(end, base)}`
}

export function createLiquidNavigationPath({
  rect,
  radius,
  direction,
  energy,
}: {
  rect: LiquidNavigationRect
  radius: number
  direction: { x: number; y: number }
  energy: number
}) {
  const { left, top, width, height } = rect
  const right = left + width
  const bottom = top + height
  const r = clamp(radius, 0, Math.min(width, height) / 2)
  const horizontalExtension = NAV_LIQUID_MOTION.deformation.leadingEdgeOffset * energy
  const verticalExtension = NAV_LIQUID_MOTION.deformation.verticalEdgeOffset * energy
  const sideBulge = direction.x * horizontalExtension
  const horizontalBulge = -direction.y * verticalExtension
  const topBulge = direction.y < 0 ? horizontalBulge : -horizontalBulge * 0.22
  const bottomBulge = direction.y > 0 ? -horizontalBulge : horizontalBulge * 0.22
  const rightBulge = direction.x > 0 ? sideBulge : sideBulge * 0.22
  const leftBulge = direction.x < 0 ? sideBulge : -sideBulge * 0.22

  const commands = [
    `M ${(left + r).toFixed(2)} ${top.toFixed(2)}`,
    curvedEdge(left + r, right - r, top, topBulge, true),
    roundedCorner(right - r, top + r, r, -Math.PI / 2, 0),
    curvedEdge(top + r, bottom - r, right, rightBulge, false),
    roundedCorner(right - r, bottom - r, r, 0, Math.PI / 2),
    curvedEdge(right - r, left + r, bottom, bottomBulge, true),
    roundedCorner(left + r, bottom - r, r, Math.PI / 2, Math.PI),
    curvedEdge(bottom - r, top + r, left, leftBulge, false),
    roundedCorner(left + r, top + r, r, Math.PI, Math.PI * 1.5),
    'Z',
  ]
  return commands.join(' ')
}
