/**
 * cognitive-memory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent learning layer for Novo's Cognitive OS.
 *
 * This module LEARNS from the user over time — transforming the static
 * bio-energetic model into an adaptive system that:
 *
 *  1. Detects ACTUAL peak hours from task completion timestamps
 *  2. Predicts burnout trajectories (rolling 7-day fatigue trend)
 *  3. Learns work patterns (deep work vs. admin vs. creative)
 *  4. Surfaces personalized recommendations grounded in real data
 *
 * Architecture: Pure client-side analysis + server persistence via
 *   /api/cognitive/patterns  (GET/POST)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HourlyProductivity {
  hour: number            // 0–23
  completions: number     // tasks completed during this hour (total, all time)
  avgFocusQuality: number // 0–5
  sampleCount: number     // number of days with data at this hour
}

export interface DailyFatigueSample {
  date: string            // YYYY-MM-DD
  fatigueScore: number    // 0–100
  tasksCompleted: number
  focusMinutes: number
  phase: string
}

export interface WorkPattern {
  label: 'deep_work' | 'admin' | 'creative' | 'learning' | 'communication'
  peakHours: number[]     // hours where this pattern occurs most
  avgDuration: number     // avg session length in minutes
}

export interface BurnoutPrediction {
  risk: 'none' | 'low' | 'moderate' | 'high' | 'critical'
  confidence: number      // 0–1
  trend: 'improving' | 'stable' | 'declining'
  daysUntilCritical: number | null
  recommendation: string
}

export interface CognitiveLearningProfile {
  userId: string
  updatedAt: string
  /** Actual peak hours derived from task completion data */
  learnedPeakHours: number[]
  /** Hour-by-hour productivity distribution */
  hourlyProductivity: HourlyProductivity[]
  /** 7-day rolling fatigue samples */
  fatigueHistory: DailyFatigueSample[]
  /** Identified work patterns */
  workPatterns: WorkPattern[]
  /** Current burnout prediction */
  burnoutPrediction: BurnoutPrediction
  /** Personalized optimal wake recommendation (hour) */
  recommendedWakeHour: number
  /** Chronotype confidence from real data (overrides settings if high) */
  learnedChronotype: 'early_bird' | 'intermediate' | 'night_owl' | null
  chronotypeConfidence: number  // 0–1
}

// ─── Burnout Prediction ───────────────────────────────────────────────────────

/**
 * Analyzes rolling 7-day fatigue trend to predict burnout trajectory.
 * Uses linear regression on the fatigue time series.
 */
export function predictBurnout(history: DailyFatigueSample[]): BurnoutPrediction {
  if (history.length < 3) {
    return {
      risk: 'none',
      confidence: 0,
      trend: 'stable',
      daysUntilCritical: null,
      recommendation: 'Not enough data yet. Keep using Novo for personalized insights.',
    }
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-7)

  // Linear regression: slope of fatigue over time
  const n = recent.length
  const xs = recent.map((_, i) => i)
  const ys = recent.map(d => d.fatigueScore)

  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n

  const numerator = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0)
  const denominator = xs.reduce((s, x) => s + (x - xMean) ** 2, 0)
  const slope = denominator === 0 ? 0 : numerator / denominator

  const currentFatigue = recent[recent.length - 1].fatigueScore
  const confidence = Math.min(1, n / 7)

  // Days until fatigue hits 85 (critical threshold)
  const CRITICAL = 85
  const daysUntilCritical = slope > 0 && currentFatigue < CRITICAL
    ? Math.ceil((CRITICAL - currentFatigue) / slope)
    : null

  let risk: BurnoutPrediction['risk']
  if (currentFatigue >= 85 || (slope > 5 && currentFatigue > 65)) risk = 'critical'
  else if (currentFatigue >= 70 || slope > 3) risk = 'high'
  else if (currentFatigue >= 55 || slope > 1.5) risk = 'moderate'
  else if (currentFatigue >= 40 || slope > 0.5) risk = 'low'
  else risk = 'none'

  const trend: BurnoutPrediction['trend'] =
    slope > 1 ? 'declining' : slope < -1 ? 'improving' : 'stable'

  const recommendations: Record<BurnoutPrediction['risk'], string> = {
    none: 'Your cognitive load is well-managed. Excellent work.',
    low: 'Slight fatigue accumulation detected. Schedule a recovery block tomorrow morning.',
    moderate: 'Fatigue trending upward over 3+ days. Reduce deep work sessions by 30% today.',
    high: 'High burnout risk. Activate guided breathing, defer non-urgent tasks to next week.',
    critical: 'Critical burnout imminent. Take a recovery day. All non-essential tasks deferred automatically.',
  }

  return {
    risk,
    confidence,
    trend,
    daysUntilCritical,
    recommendation: recommendations[risk],
  }
}

// ─── Peak Hour Learning ───────────────────────────────────────────────────────

/**
 * Extracts actual peak productivity hours from task completion timestamps.
 * Returns hours sorted by productivity score descending.
 */
export function learnPeakHours(
  focusSessions: Array<{ startTime: string; focusQuality?: number; completed: boolean }>,
  taskCompletions: Array<{ completedAt: string }>
): HourlyProductivity[] {
  const hourBuckets: Record<number, { completions: number; qualitySum: number; daySamples: Set<string> }> = {}

  // Initialize all 24 hours
  for (let h = 0; h < 24; h++) {
    hourBuckets[h] = { completions: 0, qualitySum: 0, daySamples: new Set() }
  }

  // Count task completions per hour
  for (const tc of taskCompletions) {
    const d = new Date(tc.completedAt)
    const h = d.getHours()
    hourBuckets[h].completions++
    hourBuckets[h].daySamples.add(d.toISOString().split('T')[0])
  }

  // Accumulate focus quality per hour
  for (const fs of focusSessions) {
    if (!fs.completed) continue
    const d = new Date(fs.startTime)
    const h = d.getHours()
    hourBuckets[h].qualitySum += fs.focusQuality ?? 3
    hourBuckets[h].daySamples.add(d.toISOString().split('T')[0])
  }

  return Array.from({ length: 24 }, (_, h) => {
    const b = hourBuckets[h]
    const sampleCount = b.daySamples.size
    return {
      hour: h,
      completions: b.completions,
      avgFocusQuality: sampleCount > 0 ? b.qualitySum / sampleCount : 0,
      sampleCount,
    }
  })
}

/**
 * Identifies top-N peak hours from the hourly productivity data.
 * Requires at least 5 samples in a bucket to be considered reliable.
 */
export function extractPeakHours(
  hourlyData: HourlyProductivity[],
  topN = 3,
  minSamples = 5
): number[] {
  return hourlyData
    .filter(h => h.sampleCount >= minSamples)
    .sort((a, b) => {
      // Composite score: completions (60%) + focus quality (40%)
      const scoreA = a.completions * 0.6 + a.avgFocusQuality * 10 * 0.4
      const scoreB = b.completions * 0.6 + b.avgFocusQuality * 10 * 0.4
      return scoreB - scoreA
    })
    .slice(0, topN)
    .map(h => h.hour)
    .sort((a, b) => a - b)
}

// ─── Chronotype Learning ──────────────────────────────────────────────────────

/**
 * Infers chronotype from the distribution of peak hours.
 * Returns null if not enough data to be confident.
 */
export function inferChronotype(
  peakHours: number[]
): { chronotype: 'early_bird' | 'intermediate' | 'night_owl'; confidence: number } | null {
  if (peakHours.length === 0) return null

  const avgPeak = peakHours.reduce((s, h) => s + h, 0) / peakHours.length

  // If primary peak is before 10am → early bird
  if (avgPeak < 10) return { chronotype: 'early_bird', confidence: 0.8 }
  // If primary peak is between 10–17 → intermediate
  if (avgPeak <= 17) return { chronotype: 'intermediate', confidence: 0.75 }
  // Night owl: peaks after 17
  return { chronotype: 'night_owl', confidence: 0.7 }
}

// ─── Client-side Profile Builder ──────────────────────────────────────────────

/**
 * Builds a full CognitiveLearningProfile from raw app data.
 * Called when data is fetched from the API, then cached locally.
 */
export function buildLearningProfile(
  userId: string,
  rawData: {
    focusSessions: Array<{ startTime: string; focusQuality?: number; completed: boolean }>
    taskCompletions: Array<{ completedAt: string }>
    fatigueHistory: DailyFatigueSample[]
  }
): CognitiveLearningProfile {
  const hourlyProductivity = learnPeakHours(rawData.focusSessions, rawData.taskCompletions)
  const learnedPeakHours = extractPeakHours(hourlyProductivity)
  const burnoutPrediction = predictBurnout(rawData.fatigueHistory)

  const chronotypeResult = inferChronotype(learnedPeakHours)

  // Recommended wake = earliest peak hour - 2h (to have warm-up time)
  const earliestPeak = learnedPeakHours[0] ?? 7
  const recommendedWakeHour = Math.max(5, earliestPeak - 2)

  return {
    userId,
    updatedAt: new Date().toISOString(),
    learnedPeakHours,
    hourlyProductivity,
    fatigueHistory: rawData.fatigueHistory.slice(-30), // last 30 days
    workPatterns: [],  // Populated by AI analysis endpoint
    burnoutPrediction,
    recommendedWakeHour,
    learnedChronotype: chronotypeResult?.chronotype ?? null,
    chronotypeConfidence: chronotypeResult?.confidence ?? 0,
  }
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/** Fetch cognitive learning profile from server */
export async function fetchCognitiveProfile(userId: string): Promise<CognitiveLearningProfile | null> {
  try {
    const res = await fetch('/api/cognitive/patterns')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Persist a daily fatigue sample to the server */
export async function recordFatigueSample(sample: DailyFatigueSample): Promise<void> {
  try {
    await fetch('/api/cognitive/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'fatigue_sample', data: sample }),
    })
  } catch {
    // Non-blocking — local state is source of truth
  }
}
