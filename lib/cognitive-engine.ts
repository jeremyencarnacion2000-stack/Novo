/**
 * cognitive-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure algorithmic core for Novo Heritage's Cognitive Layer.
 * No React dependencies — fully testable, deterministic functions.
 *
 * Bio-energetic model:
 *   Ultradian rhythm: ~90-min cycles throughout the day.
 *   Chronotype bias: peak focus anchored to morning / early afternoon.
 *   Synaptic fatigue: accumulates with completed high-energy tasks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Public Types ─────────────────────────────────────────────────────────────

export type CognitivePhase =
  | 'PEAK_FOCUS'       // High dopamine / top attentional bandwidth
  | 'LINEAR_EXECUTION' // Moderate attention — admin, meetings, routine
  | 'SYNAPTIC_FATIGUE' // Accumulated fatigue — mandatory recovery block
  | 'REDUCED_CAPACITY_MODE' // Underpowered/strained peak window due to poor biometrics

export type Chronotype = 'morning_lark' | 'intermediate' | 'night_owl'

export interface HabitEntry {
  completedAt: Date   // UTC timestamp when habit was logged
  energyCost: number  // 0–1 — how cognitively expensive this habit is
}

export interface BioState {
  phase: CognitivePhase
  /** 0–100 — how depleted the attentional reservoir is */
  fatigueScore: number
  /** 0–100 — raw attentional bandwidth available right now */
  attentionScore: number
  /** Ultradian cycle index within the active wake window (0-based) */
  ultradianCycle: number
  /** Minutes until the next phase boundary */
  minutesToNextPhase: number
  /** Human-readable label for current phase */
  label: string
  /** Whether blue-light reduction should be active */
  blueLight: boolean
  /** Recommended binaural/ambient playlist category */
  recommendedAudioCategory: 'focus' | 'ambient' | 'sleep' | 'none'
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Duration of one ultradian cycle in minutes */
const ULTRADIAN_MINUTES = 90

/** Peak PEAK_FOCUS windows by chronotype (hour ranges, inclusive) */
const PEAK_WINDOWS: Record<Chronotype, Array<[number, number]>> = {
  morning_lark:  [[5, 9],   [10, 12]],
  intermediate:  [[7, 11],  [14, 16]],
  night_owl:     [[10, 14], [20, 23]],
}

/** LINEAR_EXECUTION windows (non-peak, non-fatigue) by chronotype */
const LINEAR_WINDOWS: Record<Chronotype, Array<[number, number]>> = {
  morning_lark:  [[12, 15], [16, 18]],
  intermediate:  [[11, 14], [16, 19]],
  night_owl:     [[14, 20], [9, 10]],
}

/** Absolute late-night hours that force SYNAPTIC_FATIGUE regardless of anything else */
const LATE_NIGHT_HOURS: [number, number] = [0, 4] // 00:00 → 04:59

/** Accumulated energy cost threshold that triggers SYNAPTIC_FATIGUE */
const FATIGUE_THRESHOLD = 0.65

// ─── Utility helpers ──────────────────────────────────────────────────────────

function hourInRange(hour: number, [start, end]: [number, number]): boolean {
  if (start <= end) return hour >= start && hour <= end
  // Wraps midnight (e.g. 23–05)
  return hour >= start || hour <= end
}

function isInWindows(hour: number, windows: Array<[number, number]>): boolean {
  return windows.some(w => hourInRange(hour, w))
}

function isLegacyPresentationPhase(phase: CognitivePhase): boolean {
  return phase === 'SYNAPTIC_FATIGUE' || phase === 'REDUCED_CAPACITY_MODE'
}

/**
 * Compute the accumulated energy cost for habits completed TODAY before `now`.
 * Each habit deducts from the attentional reservoir.
 */
function computeDailyFatigueLoad(habits: HabitEntry[], now: Date): number {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const todayHabits = habits.filter(h => h.completedAt >= startOfDay && h.completedAt <= now)
  const totalLoad = todayHabits.reduce((sum, h) => sum + h.energyCost, 0)

  // Normalize: 4 high-energy tasks (4 × 1.0) = 100 % depleted
  return Math.min(1, totalLoad / 4)
}

/**
 * Circadian attentional bandwidth curve.
 * Returns a [0, 1] score representing natural cognitive energy at `hour`.
 * Uses a dual-peak sinusoidal model tuned for intermediate chronotype,
 * then shifted by chronotype offset.
 */
function circadianScore(hour: number, chronotype: Chronotype): number {
  const offset: Record<Chronotype, number> = {
    morning_lark: -2,
    intermediate: 0,
    night_owl: +3,
  }
  const shifted = (hour + offset[chronotype] + 24) % 24

  // Primary morning peak at ~9h, secondary afternoon peak at ~15h
  const morning = Math.exp(-0.5 * Math.pow((shifted - 9) / 3.5, 2))
  const afternoon = 0.65 * Math.exp(-0.5 * Math.pow((shifted - 15) / 2.5, 2))
  const nightPenalty = shifted < 6 || shifted > 21 ? 0.3 : 1

  return Math.min(1, (morning + afternoon) * nightPenalty)
}

/**
 * Compute ultradian cycle index and minutes into the current cycle
 * based on the assumed wake time.
 */
function ultradianPosition(now: Date, wakeHour: number): { cycle: number; minutesIntoCycle: number } {
  const minutesSinceWake =
    (now.getHours() - wakeHour) * 60 + now.getMinutes()

  if (minutesSinceWake < 0) {
    return { cycle: 0, minutesIntoCycle: 0 }
  }

  const cycle = Math.floor(minutesSinceWake / ULTRADIAN_MINUTES)
  const minutesIntoCycle = minutesSinceWake % ULTRADIAN_MINUTES
  return { cycle, minutesIntoCycle }
}

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface EngineInput {
  now: Date
  chronotype?: Chronotype
  completedHabits?: HabitEntry[]
  /** Assumed wake hour (24h) — defaults to chronotype anchor */
  wakeHour?: number
  /** Verified user stress score from a connected biometric provider */
  userStressScore?: number
}

/**
 * `computeBioState` — the central cognitive phase calculator.
 * Pure function: same input always returns same output.
 */
export function computeBioState({
  now,
  chronotype = 'intermediate',
  completedHabits = [],
  wakeHour,
  userStressScore: _userStressScore,
}: EngineInput): BioState {
  const hour = now.getHours()
  const minute = now.getMinutes()

  const defaultWakeHour: Record<Chronotype, number> = {
    morning_lark: 5,
    intermediate: 7,
    night_owl: 9,
  }
  const wake = wakeHour ?? defaultWakeHour[chronotype]

  // ── 1. Late-night absolute override ───────────────────────────────────────
  // ── 2. Fatigue from completed habits ─────────────────────────────────────
  const fatigueLoad = computeDailyFatigueLoad(completedHabits, now)

  // ── 3. Circadian bandwidth ────────────────────────────────────────────────
  const bandwidth = circadianScore(hour, chronotype)

  // ── 4. Composite attention score ─────────────────────────────────────────
  // Fatigue erodes the natural bandwidth
  const attentionRaw = bandwidth * (1 - fatigueLoad * 0.8)
  const attentionScore = Math.round(attentionRaw * 100)
  const fatigueScore = Math.round(fatigueLoad * 100)

  // ── 5. Ultradian cycle ────────────────────────────────────────────────────
  const { cycle: ultradianCycle, minutesIntoCycle } = ultradianPosition(now, wake)
  // The last 20 min of each 90-min cycle are naturally lower-energy
  const inUltradianDip = minutesIntoCycle > 70

  // ── 6. Phase classification ───────────────────────────────────────────────
  let phase: CognitivePhase

  if (
    isInWindows(hour, PEAK_WINDOWS[chronotype]) &&
    !inUltradianDip &&
    attentionRaw >= 0.60
  ) {
    phase = 'PEAK_FOCUS'
  } else if (isInWindows(hour, LINEAR_WINDOWS[chronotype]) && attentionRaw >= 0.35) {
    phase = 'LINEAR_EXECUTION'
  } else {
    phase = 'LINEAR_EXECUTION'
  }

  // ── 6b. Real-time stress degradation override ────────────────────────────
  // ── 7. Minutes to next phase boundary ────────────────────────────────────
  const minutesRemaining = ULTRADIAN_MINUTES - minutesIntoCycle
  let minutesToNextPhase: number
  if (isLegacyPresentationPhase(phase)) {
    if (hour < 5) {
      // Count minutes until 5:00 AM (end of forced late-night fatigue)
      const targetHour = 5
      const minsUntilTarget = ((targetHour - hour + 24) % 24) * 60 - minute
      minutesToNextPhase = Math.max(1, minsUntilTarget)
    } else if (inUltradianDip) {
      minutesToNextPhase = Math.max(1, minutesRemaining)
    } else {
      // Fatigue from load or low attention — find next hour where circadian > 0.35
      let minsAhead = 30
      for (let m = 30; m <= 480; m += 15) {
        const futureHour = (hour + Math.floor((minute + m) / 60)) % 24
        if (circadianScore(futureHour, chronotype) >= 0.35) {
          minsAhead = m
          break
        }
      }
      minutesToNextPhase = minsAhead
    }
  } else {
    minutesToNextPhase = minutesRemaining
  }

  // ── 8. Blue light + audio recommendation ─────────────────────────────────
  const blueLight = hour >= 20 || hour < 6

  let recommendedAudioCategory: BioState['recommendedAudioCategory']
  if (phase === 'PEAK_FOCUS') {
    recommendedAudioCategory = 'focus'
  } else {
    recommendedAudioCategory = 'none'
  }

  // ── 9. Human label ───────────────────────────────────────────────────────
  const label: Record<CognitivePhase, string> = {
    PEAK_FOCUS: 'Peak Focus Window',
    LINEAR_EXECUTION: 'Execution Mode',
    SYNAPTIC_FATIGUE: 'Recovery Required',
    REDUCED_CAPACITY_MODE: 'Reduced Capacity Mode',
  }

  return {
    phase,
    fatigueScore,
    attentionScore,
    ultradianCycle,
    minutesToNextPhase,
    label: label[phase],
    blueLight,
    recommendedAudioCategory,
  }
}

// ─── Playlist search term helpers ────────────────────────────────────────────

export const COGNITIVE_PLAYLIST_QUERIES: Record<
  BioState['recommendedAudioCategory'],
  string
> = {
  focus:   'binaural beats deep focus 40hz',
  ambient: 'white noise ambient study lofi',
  sleep:   'sleep music delta waves 432hz',
  none:    '',
}
