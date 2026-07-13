// lib/experiment/deep-work-window.ts
//
// Pre-registered hypothesis: interruption frequency predicts optimal
// deep-work windows. This file computes the two candidate windows:
//
// - REAL: the 2-hour window (within 6:00-22:00) with the lowest historical
//   interruption density, computed from FocusSession rows.
// - CONTROL: a yoked window — structurally identical in how it's produced
//   (same formula, same 2-hour shape) but derived from a DIFFERENT random
//   historical reference point, so it's causally disconnected from today's
//   actual interruption pattern while looking equally "personalized." This
//   is what keeps the control condition indistinguishable from the real one
//   by inspection alone — blinding can't leak through the shape of the
//   recommendation, only through the (encrypted, hidden) label.
//
// Neither function is told which branch is "real" — the caller (the daily
// API route) decides which one to invoke based on the decrypted condition,
// and only ever persists the ONE window that was actually shown.

import { prisma } from '@/lib/prisma'

const WINDOW_HOURS = 2
const EARLIEST_HOUR = 6
const LATEST_HOUR = 22 // last window is [20,22)
const LOOKBACK_DAYS = 60

export interface DeepWorkWindow {
  startHour: number // 0-23
  endHour: number
}

async function getInterruptionDensityByHour(userId: string, asOf: Date): Promise<number[]> {
  const since = new Date(asOf)
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  const sessions = await prisma.focusSession.findMany({
    where: { userId, startTime: { gte: since, lt: asOf } },
    select: { startTime: true, interruptions: true, duration: true },
  })

  // interruptions per logged focus-minute, per hour-of-day bucket — normalizes
  // for hours that are used more/less often rather than raw interruption counts.
  const interruptionsByHour = new Array(24).fill(0)
  const minutesByHour = new Array(24).fill(0)

  for (const s of sessions) {
    const hour = s.startTime.getHours()
    interruptionsByHour[hour] += s.interruptions
    minutesByHour[hour] += s.duration || 1
  }

  return interruptionsByHour.map((count, hour) => {
    const minutes = minutesByHour[hour]
    return minutes > 0 ? count / minutes : Number.POSITIVE_INFINITY // no data = not eligible
  })
}

function bestWindowFromDensity(density: number[]): DeepWorkWindow {
  let bestStart = EARLIEST_HOUR
  let bestScore = Number.POSITIVE_INFINITY
  let foundData = false

  for (let start = EARLIEST_HOUR; start <= LATEST_HOUR - WINDOW_HOURS; start++) {
    const slice = density.slice(start, start + WINDOW_HOURS)
    if (slice.every((v) => v === Number.POSITIVE_INFINITY)) continue // no data for this window at all
    const finite = slice.filter((v) => v !== Number.POSITIVE_INFINITY)
    const score = finite.reduce((a, b) => a + b, 0) / finite.length
    foundData = true
    if (score < bestScore) {
      bestScore = score
      bestStart = start
    }
  }

  if (!foundData) {
    // Cold start — no focus session history yet. Default to a reasonable
    // late-morning window rather than fabricating a "personalized" answer.
    bestStart = 9
  }

  return { startHour: bestStart, endHour: bestStart + WINDOW_HOURS }
}

/** REAL condition: window with the lowest interruption density for THIS user, as of today. */
export async function computeRealWindow(userId: string, forDate: Date): Promise<DeepWorkWindow> {
  const density = await getInterruptionDensityByHour(userId, forDate)
  return bestWindowFromDensity(density)
}

/**
 * CONTROL condition: same formula, applied "as of" a different, randomly
 * chosen past date (seeded deterministically by the target date + userId so
 * it's reproducible for analysis) instead of today. Looks equally derived
 * and equally variable — just not caused by today's actual interruptions.
 */
export async function computeControlWindow(userId: string, forDate: Date): Promise<DeepWorkWindow> {
  const seed = hashSeed(userId + forDate.toISOString())
  const yokedOffsetDays = 7 + (seed % 53) // 7-59 days back — outside the real window's own lookback anchor point
  const yokedAsOf = new Date(forDate)
  yokedAsOf.setDate(yokedAsOf.getDate() - yokedOffsetDays)

  const density = await getInterruptionDensityByHour(userId, yokedAsOf)
  return bestWindowFromDensity(density)
}

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
