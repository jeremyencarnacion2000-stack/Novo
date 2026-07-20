// Detects a consistent "I always stop around minute X" pattern from real
// FocusSession history (duration = planned, actualDuration = real if
// stopped early — both already recorded, nothing new to capture). Kept as
// a pure function over plain session data (like calendar-signal.ts) so the
// clustering logic is unit-testable without a database.

export interface FocusSessionSample {
  duration: number
  actualDuration: number | null
}

const MIN_SAMPLE_SIZE = 5
const CLUSTER_BAND_MINUTES = 7
const MIN_CLUSTER_RATIO = 0.6

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Returns the typical early-stop minute mark when the pattern is real and
// consistent enough to state as fact, or null when there isn't enough
// evidence — never guesses from a handful of scattered early stops.
export function detectAbandonmentPattern(sessions: FocusSessionSample[]): number | null {
  const earlyStops = sessions
    .filter((s): s is FocusSessionSample & { actualDuration: number } =>
      s.actualDuration != null && s.actualDuration < s.duration
    )
    .map(s => s.actualDuration)

  if (earlyStops.length < MIN_SAMPLE_SIZE) return null

  const center = median(earlyStops)
  const inBand = earlyStops.filter(m => Math.abs(m - center) <= CLUSTER_BAND_MINUTES)

  if (inBand.length / earlyStops.length < MIN_CLUSTER_RATIO) return null

  return Math.round(median(inBand))
}
