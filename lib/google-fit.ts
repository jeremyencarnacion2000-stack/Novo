/**
 * lib/google-fit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Fit REST API data-layer for Novo Heritage Cognitive Engine.
 *
 * Consumes the Google Fit Aggregate Dataset API to extract:
 *   • Sleep segments (com.google.sleep.segment)
 *   • Heart rate samples (com.google.heart_rate.bpm)
 *
 * All functions are pure data-fetching + parsing — no React dependencies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  GoogleFitAggregateResponse,
  GoogleFitBucket,
  SleepSegment,
  SleepStageValue,
  SleepSummary,
  HeartRateSample,
  HeartRateSummary,
  BiometricPayload,
  SLEEP_STAGE_LABELS,
} from '@/types/biometrics'
import { classifyStressLevel } from '@/types/biometrics'

// ─── Constants ───────────────────────────────────────────────────────────────

const GOOGLE_FIT_AGGREGATE_URL =
  'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate'

/** Google Fit data type identifiers */
const DATA_TYPES = {
  SLEEP_SEGMENT: 'com.google.sleep.segment',
  HEART_RATE_BPM: 'com.google.heart_rate.bpm',
} as const

/** Hours to look back for biometric data */
const QUERY_WINDOW_HOURS = 24

/** Sleep stages that count as "actual sleep" (not awake or out-of-bed) */
const ACTUAL_SLEEP_STAGES: SleepStageValue[] = [2, 4, 5, 6]

// ─── Google Fit Aggregate API Request ────────────────────────────────────────

interface AggregateRequestBody {
  aggregateBy: Array<{ dataTypeName: string; dataSourceId?: string }>
  bucketByTime: { durationMillis: number }
  startTimeMillis: number
  endTimeMillis: number
}

/**
 * Execute a POST to the Google Fit Users Dataset Aggregate endpoint.
 * Returns the raw response or null on auth/network failure.
 */
async function fetchGoogleFitAggregate(
  accessToken: string,
  dataTypeNames: string[],
  startTimeMillis: number,
  endTimeMillis: number
): Promise<GoogleFitAggregateResponse | null> {
  const body: AggregateRequestBody = {
    aggregateBy: dataTypeNames.map((name) => ({ dataTypeName: name })),
    bucketByTime: {
      // Single bucket spanning the entire query window
      durationMillis: endTimeMillis - startTimeMillis,
    },
    startTimeMillis,
    endTimeMillis,
  }

  try {
    const response = await fetch(GOOGLE_FIT_AGGREGATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(
        `[GoogleFit] Aggregate request failed (${response.status}):`,
        errorBody
      )

      // 401/403 = token expired or insufficient scopes
      if (response.status === 401 || response.status === 403) {
        console.error(
          '[GoogleFit] Auth error — user may need to re-consent with fitness scopes.'
        )
      }
      return null
    }

    return (await response.json()) as GoogleFitAggregateResponse
  } catch (networkError) {
    console.error('[GoogleFit] Network error:', networkError)
    return null
  }
}

// ─── Sleep Data Parsing ─────────────────────────────────────────────────────

/**
 * Parse sleep segments from a Google Fit aggregate response.
 * Each data point contains a sleep stage integer value in value[0].intVal.
 */
function parseSleepSegments(buckets: GoogleFitBucket[]): SleepSegment[] {
  const segments: SleepSegment[] = []

  for (const bucket of buckets) {
    for (const dataset of bucket.dataset) {
      for (const point of dataset.point) {
        const stageVal = point.value?.[0]?.intVal
        if (stageVal === undefined || stageVal === null) continue

        const stage = (Math.max(0, Math.min(6, stageVal)) as SleepStageValue)
        const startMs = Number(point.startTimeNanos) / 1_000_000
        const endMs = Number(point.endTimeNanos) / 1_000_000
        const durationMinutes = Math.max(0, (endMs - startMs) / 60_000)

        // Labels imported as type — reconstruct locally for safety
        const stageLabels: Record<number, string> = {
          0: 'Unknown', 1: 'Awake', 2: 'Sleep', 3: 'Out-of-bed',
          4: 'Light Sleep', 5: 'Deep Sleep', 6: 'REM',
        }

        segments.push({
          stage,
          stageLabel: stageLabels[stage] ?? 'Unknown',
          startTime: new Date(startMs),
          endTime: new Date(endMs),
          durationMinutes: Math.round(durationMinutes * 10) / 10,
        })
      }
    }
  }

  return segments
}

/**
 * Build a sanitized SleepSummary from parsed segments.
 * Returns safe defaults when no data is available.
 */
function buildSleepSummary(segments: SleepSegment[]): SleepSummary {
  if (segments.length === 0) {
    return {
      totalSleepMinutes: 0,
      deepSleepMinutes: 0,
      remSleepMinutes: 0,
      lightSleepMinutes: 0,
      sleepEfficiency: 0,
      hasData: false,
      segments: [],
    }
  }

  const deepSleepMinutes = segments
    .filter((s) => s.stage === 5)
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  const remSleepMinutes = segments
    .filter((s) => s.stage === 6)
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  const lightSleepMinutes = segments
    .filter((s) => s.stage === 4)
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  // Generic "Sleep" stage (2) counts as light sleep for totals
  const genericSleepMinutes = segments
    .filter((s) => s.stage === 2)
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  const totalSleepMinutes =
    deepSleepMinutes + remSleepMinutes + lightSleepMinutes + genericSleepMinutes

  // Total time in bed = all segments including awake periods
  const totalTimeInBed = segments.reduce((sum, s) => sum + s.durationMinutes, 0)

  const sleepEfficiency =
    totalTimeInBed > 0
      ? Math.round((totalSleepMinutes / totalTimeInBed) * 100)
      : 0

  return {
    totalSleepMinutes: Math.round(totalSleepMinutes),
    deepSleepMinutes: Math.round(deepSleepMinutes),
    remSleepMinutes: Math.round(remSleepMinutes),
    lightSleepMinutes: Math.round(lightSleepMinutes + genericSleepMinutes),
    sleepEfficiency,
    hasData: true,
    segments,
  }
}

// ─── Heart Rate Data Parsing ────────────────────────────────────────────────

/**
 * Parse heart rate BPM samples from Google Fit aggregate buckets.
 * Each data point carries a floating-point BPM in value[0].fpVal.
 */
function parseHeartRateSamples(buckets: GoogleFitBucket[]): HeartRateSample[] {
  const samples: HeartRateSample[] = []

  for (const bucket of buckets) {
    for (const dataset of bucket.dataset) {
      for (const point of dataset.point) {
        const bpm = point.value?.[0]?.fpVal
        if (bpm === undefined || bpm === null || bpm <= 0) continue

        // Discard physiologically implausible readings (< 30 or > 220 BPM)
        if (bpm < 30 || bpm > 220) continue

        const timestampMs = Number(point.startTimeNanos) / 1_000_000
        samples.push({
          bpm: Math.round(bpm),
          timestamp: new Date(timestampMs),
        })
      }
    }
  }

  return samples
}

/**
 * Build a sanitized HeartRateSummary from parsed samples.
 * Returns safe defaults when no data is available.
 */
function buildHeartRateSummary(samples: HeartRateSample[]): HeartRateSummary {
  if (samples.length === 0) {
    return {
      averageBpm: 0,
      minBpm: 0,
      maxBpm: 0,
      sampleCount: 0,
      hasData: false,
      samples: [],
    }
  }

  const bpms = samples.map((s) => s.bpm)
  const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length

  return {
    averageBpm: Math.round(avg),
    minBpm: Math.min(...bpms),
    maxBpm: Math.max(...bpms),
    sampleCount: samples.length,
    hasData: true,
    samples,
  }
}

// ─── Stress Score Computation ───────────────────────────────────────────────

/**
 * Compute a composite User Stress Score (1–100) from biometric signals.
 *
 * Algorithm:
 *   1. Sleep deficit factor (0–50 points):
 *      - Optimal deep sleep target: ≥90 min. Below this → linearly increasing stress.
 *      - Optimal total sleep target: ≥420 min (7h). Below this → increasing stress.
 *
 *   2. Heart rate elevation factor (0–30 points):
 *      - Resting HR baseline for a healthy adult: ~65 BPM.
 *      - Each BPM above 75 adds stress linearly up to 100 BPM.
 *
 *   3. Data availability penalty:
 *      - No sleep data: defaults to 30 (mildly elevated, conservative).
 *      - No HR data: no penalty (HR is supplementary).
 *      - No data at all: returns 50 (neutral — insufficient signals).
 */
function computeUserStressScore(
  sleep: SleepSummary,
  heartRate: HeartRateSummary
): number {
  // ── No data at all → neutral score ────────────────────────────────────────
  if (!sleep.hasData && !heartRate.hasData) {
    return 50
  }

  let stressPoints = 0

  // ── Sleep deficit stress (0–50 points) ────────────────────────────────────
  if (sleep.hasData) {
    const OPTIMAL_DEEP_SLEEP = 90 // minutes
    const OPTIMAL_TOTAL_SLEEP = 420 // minutes (7 hours)

    // Deep sleep deficit: 0→25 points
    const deepSleepRatio = Math.min(1, sleep.deepSleepMinutes / OPTIMAL_DEEP_SLEEP)
    const deepSleepStress = (1 - deepSleepRatio) * 25

    // Total sleep deficit: 0→25 points
    const totalSleepRatio = Math.min(1, sleep.totalSleepMinutes / OPTIMAL_TOTAL_SLEEP)
    const totalSleepStress = (1 - totalSleepRatio) * 25

    stressPoints += deepSleepStress + totalSleepStress
  } else {
    // No sleep data → assume mild deficit (conservative bias)
    stressPoints += 30
  }

  // ── Heart rate elevation stress (0–30 points) ─────────────────────────────
  if (heartRate.hasData) {
    const BASELINE_BPM = 65
    const ELEVATED_BPM = 75
    const CRITICAL_BPM = 100

    if (heartRate.averageBpm > ELEVATED_BPM) {
      const elevationRatio = Math.min(
        1,
        (heartRate.averageBpm - ELEVATED_BPM) / (CRITICAL_BPM - ELEVATED_BPM)
      )
      stressPoints += elevationRatio * 30
    }
  }

  // Clamp to 1–100 range
  return Math.max(1, Math.min(100, Math.round(stressPoints)))
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch and normalize biometric data from Google Fit.
 * This is the single entry point for the API route.
 *
 * @param accessToken - Google OAuth access token (must include fitness scopes)
 * @param userId      - Novo Heritage user ID for the payload
 * @returns           - Fully sanitized BiometricPayload (never throws)
 */
export async function fetchBiometricPayload(
  accessToken: string,
  userId: string
): Promise<BiometricPayload> {
  const now = Date.now()
  const startTimeMillis = now - QUERY_WINDOW_HOURS * 60 * 60 * 1000

  // ── Parallel fetch: sleep segments + heart rate ─────────────────────────
  const [sleepResponse, heartRateResponse] = await Promise.allSettled([
    fetchGoogleFitAggregate(
      accessToken,
      [DATA_TYPES.SLEEP_SEGMENT],
      startTimeMillis,
      now
    ),
    fetchGoogleFitAggregate(
      accessToken,
      [DATA_TYPES.HEART_RATE_BPM],
      startTimeMillis,
      now
    ),
  ])

  // ── Extract raw buckets (null-safe) ───────────────────────────────────────
  const sleepBuckets: GoogleFitBucket[] =
    sleepResponse.status === 'fulfilled' && sleepResponse.value?.bucket
      ? sleepResponse.value.bucket
      : []

  const heartRateBuckets: GoogleFitBucket[] =
    heartRateResponse.status === 'fulfilled' && heartRateResponse.value?.bucket
      ? heartRateResponse.value.bucket
      : []

  const totalBucketCount = sleepBuckets.length + heartRateBuckets.length

  // ── Parse + normalize ─────────────────────────────────────────────────────
  const sleepSegments = parseSleepSegments(sleepBuckets)
  const heartRateSamples = parseHeartRateSamples(heartRateBuckets)

  const sleep = buildSleepSummary(sleepSegments)
  const heartRate = buildHeartRateSummary(heartRateSamples)

  // ── Compute composite stress score ────────────────────────────────────────
  const userStressScore = computeUserStressScore(sleep, heartRate)
  const stressLevel = classifyStressLevel(userStressScore)

  return {
    computedAt: new Date().toISOString(),
    userId,
    hasGoogleFitData: sleep.hasData || heartRate.hasData,
    sleep,
    heartRate,
    userStressScore,
    stressLevel,
    meta: {
      sleepDataSource: sleep.hasData ? 'google_fit' : 'fallback',
      heartRateDataSource: heartRate.hasData ? 'google_fit' : 'fallback',
      queryWindowHours: QUERY_WINDOW_HOURS,
      rawBucketCount: totalBucketCount,
    },
  }
}
