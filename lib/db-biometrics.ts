import type { BiometricPayload } from '../types/biometrics'

/**
 * Return an explicit unavailable payload when Google Fit has no data.
 *
 * Tasks, workouts and product activity can be useful operational signals, but
 * they cannot establish a user's sleep, heart rate or physiological stress.
 * Keeping this shape lets consumers represent absence honestly without adding
 * a separate mocked biometric path.
 */
export async function fetchDbBiometricPayload(userId: string): Promise<BiometricPayload> {
  const now = new Date()
  const payload: BiometricPayload = {
    computedAt: now.toISOString(),
    userId,
    hasGoogleFitData: false,
    sleep: {
      totalSleepMinutes: 0,
      deepSleepMinutes: 0,
      remSleepMinutes: 0,
      lightSleepMinutes: 0,
      sleepEfficiency: 0,
      hasData: false,
      segments: [],
    },
    heartRate: {
      averageBpm: 0,
      minBpm: 0,
      maxBpm: 0,
      sampleCount: 0,
      hasData: false,
      samples: [],
    },
    userStressScore: null,
    stressLevel: 'unavailable',
    meta: {
      sleepDataSource: 'fallback',
      heartRateDataSource: 'fallback',
      queryWindowHours: 24,
      rawBucketCount: 0,
    },
  }
  
  return payload
}
