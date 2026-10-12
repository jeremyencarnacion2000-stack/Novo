export type CompanionActivityState = 'active' | 'idle' | 'locked'

export type CompanionActivitySegment = {
  state: CompanionActivityState
  startedAt: Date
  endedAt: Date
}

export type CompanionDailyActivitySummary = {
  deviceId: string
  day: Date
  applicationId: string
  state: CompanionActivityState
  durationSeconds: number
}

export type CapturePreferences = {
  enabled: boolean
  paused: boolean
  excludedApplications: readonly string[]
}

const APPLICATION_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i

/** Accept only a process/app identifier, never a window title, URL, or path. */
export function normalizeApplicationId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate || candidate.length > 128 || /[\\/:\s]/.test(candidate)) return null

  const normalized = candidate.replace(/\.exe$/i, '').toLowerCase()
  return APPLICATION_ID.test(normalized) ? normalized : null
}

export function isCaptureAllowed(applicationId: unknown, preferences: CapturePreferences): boolean {
  if (!preferences.enabled || preferences.paused) return false
  const normalized = normalizeApplicationId(applicationId)
  if (!normalized) return false

  return !preferences.excludedApplications.some((excluded) => normalizeApplicationId(excluded) === normalized)
}

/**
 * Return distinct active time across every device. Idle and locked periods do
 * not count, and intervals that overlap on separate devices are unioned.
 */
export function calculateObservedActiveSeconds(segments: readonly CompanionActivitySegment[]): number {
  const intervals = segments
    .filter(({ state, startedAt, endedAt }) => state === 'active'
      && Number.isFinite(startedAt.getTime())
      && Number.isFinite(endedAt.getTime())
      && endedAt > startedAt)
    .map(({ startedAt, endedAt }) => [startedAt.getTime(), endedAt.getTime()] as const)
    .sort((a, b) => a[0] - b[0])

  let totalMilliseconds = 0
  let currentStart: number | null = null
  let currentEnd = 0

  for (const [start, end] of intervals) {
    if (currentStart === null) {
      currentStart = start
      currentEnd = end
    } else if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end)
    } else {
      totalMilliseconds += currentEnd - currentStart
      currentStart = start
      currentEnd = end
    }
  }

  if (currentStart !== null) totalMilliseconds += currentEnd - currentStart
  return Math.floor(totalMilliseconds / 1000)
}

export function buildActivitySignals(segments: readonly (CompanionActivitySegment & { applicationId: string })[]) {
  const days = new Map<string, Map<string, CompanionActivitySegment[]>>()

  for (const segment of segments) {
    const applicationId = normalizeApplicationId(segment.applicationId)
    if (!applicationId || !Number.isFinite(segment.startedAt.getTime()) || !Number.isFinite(segment.endedAt.getTime())) continue
    const date = segment.startedAt.toISOString().slice(0, 10)
    const apps = days.get(date) ?? new Map<string, CompanionActivitySegment[]>()
    const appSegments = apps.get(applicationId) ?? []
    appSegments.push(segment)
    apps.set(applicationId, appSegments)
    days.set(date, apps)
  }

  const signals: Array<{
    source: 'device'
    sourceRef: string
    signalType: 'active_time_daily' | 'app_usage_daily'
    label: string
    observedAt: Date
    reliability: 'direct'
  }> = []

  for (const [date, apps] of days) {
    const activeSegments = [...apps.values()].flat()
    const observedAt = new Date(Math.max(...activeSegments.map((segment) => segment.endedAt.getTime())))
    const totalSeconds = calculateObservedActiveSeconds(activeSegments)

    if (totalSeconds > 0) {
      signals.push({
        source: 'device',
        sourceRef: `daily:${date}:total`,
        signalType: 'active_time_daily',
        label: `Active time observed across connected devices: ${Math.round(totalSeconds / 60)} minutes`,
        observedAt,
        reliability: 'direct',
      })
    }

    for (const [applicationId, appSegments] of apps) {
      const activeSeconds = calculateObservedActiveSeconds(appSegments)
      if (activeSeconds === 0) continue
      signals.push({
        source: 'device',
        sourceRef: `daily:${date}:app:${applicationId}`,
        signalType: 'app_usage_daily',
        label: `${applicationId} activity observed: ${Math.round(activeSeconds / 60)} minutes`,
        observedAt: new Date(Math.max(...appSegments.map((segment) => segment.endedAt.getTime()))),
        reliability: 'direct',
      })
    }
  }

  return signals
}

/**
 * Convert privacy-bounded app/day snapshots to ledger signals. Raw intervals
 * stay on the device; cross-device totals use the largest daily observation
 * rather than summing devices and counting concurrent use twice.
 */
export function buildDailySummarySignals(summaries: readonly CompanionDailyActivitySummary[], now = new Date()) {
  const days = new Map<string, Map<string, Map<string, Map<string, number>>>>()

  for (const summary of summaries) {
    const applicationId = normalizeApplicationId(summary.applicationId)
    if (!applicationId || summary.state !== 'active' || !Number.isInteger(summary.durationSeconds) || summary.durationSeconds <= 0) continue
    const day = summary.day.toISOString().slice(0, 10)
    const devices = days.get(day) ?? new Map<string, Map<string, Map<string, number>>>()
    const apps = devices.get(summary.deviceId) ?? new Map<string, Map<string, number>>()
    const states = apps.get(applicationId) ?? new Map<string, number>()
    states.set(summary.state, Math.min(86_400, (states.get(summary.state) ?? 0) + summary.durationSeconds))
    apps.set(applicationId, states)
    devices.set(summary.deviceId, apps)
    days.set(day, devices)
  }

  const signals: Array<{
    source: 'device'
    sourceRef: string
    signalType: 'active_time_daily' | 'app_usage_daily'
    label: string
    observedAt: Date
    reliability: 'direct'
  }> = []

  for (const [date, devices] of days) {
    const appMaxima = new Map<string, number>()
    let largestDeviceTotal = 0
    for (const apps of devices.values()) {
      let deviceTotal = 0
      for (const [applicationId, states] of apps) {
        const seconds = states.get('active') ?? 0
        deviceTotal += seconds
        appMaxima.set(applicationId, Math.max(appMaxima.get(applicationId) ?? 0, seconds))
      }
      largestDeviceTotal = Math.max(largestDeviceTotal, deviceTotal)
    }

    const dayStart = Date.parse(`${date}T00:00:00.000Z`)
    const observedAt = new Date(Math.min(dayStart, now.getTime()))
    if (largestDeviceTotal > 0) {
      signals.push({
        source: 'device',
        sourceRef: `daily:${date}:total`,
        signalType: 'active_time_daily',
        label: `Active time observed on connected devices: ${Math.round(largestDeviceTotal / 60)} minutes`,
        observedAt,
        reliability: 'direct',
      })
    }

    for (const [applicationId, seconds] of [...appMaxima].sort(([a], [b]) => a.localeCompare(b))) {
      if (seconds === 0) continue
      signals.push({
        source: 'device',
        sourceRef: `daily:${date}:app:${applicationId}`,
        signalType: 'app_usage_daily',
        label: `${applicationId} activity observed: ${Math.round(seconds / 60)} minutes`,
        observedAt,
        reliability: 'direct',
      })
    }
  }

  return signals
}
