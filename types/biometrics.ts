/**
 * types/biometrics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Strict TypeScript interfaces for the Google Fit biometric data pipeline.
 *
 * Handles:
 *   • Raw Google Fit Aggregate API response shapes
 *   • Normalized BiometricPayload with null-safe defaults
 *   • Computed UserStressScore (1–100) for the Cognitive Engine
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Google Fit Raw Response Types ───────────────────────────────────────────

/** A single data point value from Google Fit aggregate buckets */
export interface GoogleFitValue {
  intVal?: number
  fpVal?: number
  stringVal?: string
  mapVal?: Array<{ key: string; value: { fpVal?: number; intVal?: number } }>
}

/** A single data point within an aggregate dataset */
export interface GoogleFitDataPoint {
  startTimeNanos: string
  endTimeNanos: string
  dataTypeName: string
  originDataSourceId?: string
  value: GoogleFitValue[]
}

/** A dataset returned inside a Google Fit aggregate bucket */
export interface GoogleFitDataset {
  dataSourceId: string
  point: GoogleFitDataPoint[]
}

/** A time-bucketed aggregate response from Google Fit REST API */
export interface GoogleFitBucket {
  startTimeMillis: string
  endTimeMillis: string
  dataset: GoogleFitDataset[]
}

/** Top-level Google Fit Aggregate Response */
export interface GoogleFitAggregateResponse {
  bucket: GoogleFitBucket[]
}

// ─── Sleep Segment Types (com.google.sleep.segment) ─────────────────────────

/**
 * Google Fit sleep stage integer values:
 *   0 = Undefined / Unknown
 *   1 = Awake (during sleep)
 *   2 = Sleep (generic)
 *   3 = Out-of-bed
 *   4 = Light sleep
 *   5 = Deep sleep
 *   6 = REM
 */
export type SleepStageValue = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const SLEEP_STAGE_LABELS: Record<SleepStageValue, string> = {
  0: 'Unknown',
  1: 'Awake',
  2: 'Sleep',
  3: 'Out-of-bed',
  4: 'Light Sleep',
  5: 'Deep Sleep',
  6: 'REM',
}

/** Parsed sleep segment with human-readable duration */
export interface SleepSegment {
  stage: SleepStageValue
  stageLabel: string
  startTime: Date
  endTime: Date
  durationMinutes: number
}

// ─── Heart Rate Types (com.google.heart_rate.bpm) ───────────────────────────

/** A single parsed heart rate sample */
export interface HeartRateSample {
  bpm: number
  timestamp: Date
}

// ─── Normalized Biometric Payload ───────────────────────────────────────────

export interface SleepSummary {
  /** Total sleep duration in minutes (all stages except Awake/Out-of-bed) */
  totalSleepMinutes: number
  /** Deep sleep (stage 5) duration in minutes */
  deepSleepMinutes: number
  /** REM sleep (stage 6) duration in minutes */
  remSleepMinutes: number
  /** Light sleep (stage 4) duration in minutes */
  lightSleepMinutes: number
  /** Sleep efficiency: (actual sleep / total time in bed) × 100 */
  sleepEfficiency: number
  /** Whether any sleep data was available at all */
  hasData: boolean
  /** Raw parsed segments for downstream analysis */
  segments: SleepSegment[]
}

export interface HeartRateSummary {
  /** Average resting heart rate (BPM) */
  averageBpm: number
  /** Minimum recorded BPM */
  minBpm: number
  /** Maximum recorded BPM */
  maxBpm: number
  /** Number of samples received */
  sampleCount: number
  /** Whether any HR data was available */
  hasData: boolean
  /** Raw parsed samples */
  samples: HeartRateSample[]
}

/**
 * The fully normalized biometric payload returned by the ingestion endpoint.
 * Biometric measurements are nullable when the provider did not supply them.
 * A missing measurement is deliberately not represented as a neutral score.
 */
export interface BiometricPayload {
  /** ISO timestamp of when this payload was computed */
  computedAt: string
  /** User ID from the session */
  userId: string
  /** Whether Google Fit returned ANY usable data */
  hasGoogleFitData: boolean

  sleep: SleepSummary
  heartRate: HeartRateSummary

  /**
   * Composite User Stress Score (1–100) when sufficient physiological data exists.
   *
   * Derived from:
   *   • Sleep quality deficit (low deep sleep / low total sleep = higher stress)
   *   • Resting heart rate elevation (above personal baseline = higher stress)
   *   • It is absent when no verified biometric source is connected
   *
   * 1  = Fully recovered, zero stress indicators
   * 50 = Baseline / insufficient data
   * 100 = Extreme physiological stress signals
   */
  userStressScore: number | null

  /** Human-readable stress level label */
  stressLevel: 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical' | 'unavailable'

  /** Diagnostic metadata for debugging */
  meta: {
    sleepDataSource: 'google_fit' | 'fallback'
    heartRateDataSource: 'google_fit' | 'fallback'
    queryWindowHours: number
    rawBucketCount: number
  }
}

// ─── Stress Score Classification ────────────────────────────────────────────

export function classifyStressLevel(
  score: number
): BiometricPayload['stressLevel'] {
  if (score <= 15) return 'minimal'
  if (score <= 30) return 'low'
  if (score <= 50) return 'moderate'
  if (score <= 70) return 'elevated'
  if (score <= 85) return 'high'
  return 'critical'
}
