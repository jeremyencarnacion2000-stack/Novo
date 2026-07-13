import { inngest } from '../client'
import { prisma } from '@/lib/prisma'

// ─── Types ─────────────────────────────────────────────────────────────────

type SignalType =
  | 'task_created'
  | 'task_completed'
  | 'task_deferred'
  | 'focus_started'
  | 'focus_finished'
  | 'routine_completed'
  | 'routine_skipped'

type TrustLevel = 'initial' | 'learning' | 'adapted' | 'validated'
type Chronotype = '' | 'morning_lark' | 'night_owl' | 'intermediate'
type FrictionPoint = '' | 'procrastination' | 'context_switching' | 'overcommitment' | 'lack_of_structure'
type DecisionFatigueRisk = 'low' | 'moderate' | 'high' | 'critical'

// ─── Confidence: Non-Linear Growth Model ────────────────────────────────────
// Zones: 42→60 fast | 60→80 moderate | 80→95 slow | 95→100 very slow
function confidenceGainPerSignal(current: number): number {
  if (current < 60) return 0.75
  if (current < 80) return 0.28
  if (current < 95) return 0.07
  return 0.015
}

// ─── Trust Level Derivation ─────────────────────────────────────────────────
function deriveTrustLevel(score: number): TrustLevel {
  if (score >= 91) return 'validated'
  if (score >= 76) return 'adapted'
  if (score >= 56) return 'learning'
  return 'initial'
}

// ─── Format hour as HH:MM ───────────────────────────────────────────────────
function hourToTime(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

// ─── Step shim ───────────────────────────────────────────────────────────────
// Inngest's `step.run(name, fn)` just checkpoints `await fn()`. This minimal
// shape lets the same handler run either under real Inngest OR inline (see
// lib/twin-signal.ts) — the free tier has no Inngest keys, so signals are
// processed inline instead of enqueued to a queue that never drains.
type StepLike = { run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T> }

// ─── Handler (extracted so it can run inline, not only via Inngest) ──────────
export async function processTwinSignalHandler(
  { event, step }: { event: { data: any }; step: StepLike }
) {
    const { userId, signal, hour, duration, quality } = event.data as {
      userId: string
      signal: SignalType
      hour: number
      duration?: number
      quality?: number
    }

    // ── Step 1: Get or create CognitiveTwinRecord ────────────────────────────
    const twin = await step.run('get-or-create-twin', async () => {
      let record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
      if (!record) {
        record = await prisma.cognitiveTwinRecord.create({
          data: { userId, confidenceScore: 42, trustLevel: 'initial', isInitialized: false, totalSignals: 0 },
        })
      }
      return record
    })

    // ── Step 2: Append BehavioralSignal ─────────────────────────────────────
    await step.run('append-signal', async () => {
      await prisma.behavioralSignal.create({
        data: {
          userId,
          twinId: twin.id,
          signal,
          hour: hour ?? new Date().getHours(),
          duration: duration ?? null,
          quality: quality ?? null,
        },
      })
    })

    // ── Step 3: Load 14-day signal window for inference ──────────────────────
    // Inngest checkpoints step results as JSON, so occurredAt comes back as a
    // string, not a Date — re-hydrate once here rather than at each of the
    // rules below that compare it against a real Date with `>=`/`<`.
    const recentSignals = await step.run('load-signals', async () => {
      const since = new Date()
      since.setDate(since.getDate() - 14)
      const signals = await prisma.behavioralSignal.findMany({
        where: { userId, occurredAt: { gte: since } },
        orderBy: { occurredAt: 'asc' },
      })
      return signals.map(s => ({ ...s, occurredAt: s.occurredAt.toISOString() }))
    }).then(signals => signals.map(s => ({ ...s, occurredAt: new Date(s.occurredAt) })))

    // ── Step 4: Run Inference Rules ──────────────────────────────────────────
    const changes = await step.run('run-inference-rules', async () => {
      const logs: Array<{ changeType: string; description: string; prevValue?: string; newValue?: string }> = []

      const currentEnergy = (twin.energyCurve as Record<string, unknown>) ?? {}
      const currentBottlenecks = (twin.bottlenecks as Record<string, unknown>) ?? {}
      const currentMetrics = (twin.metrics as Record<string, unknown>) ?? {}

      let newEnergy = { ...currentEnergy }
      let newBottlenecks = { ...currentBottlenecks }
      let newMetrics = { ...currentMetrics }
      let patternBonus = 0

      const focusSessions = recentSignals.filter(s => s.signal === 'focus_finished' && s.hour !== null)
      const deferredSignals = recentSignals.filter(s => s.signal === 'task_deferred')
      const createdSignals = recentSignals.filter(s => s.signal === 'task_created')
      const completedSignals = recentSignals.filter(s => s.signal === 'task_completed')
      const skippedRoutines = recentSignals.filter(s => s.signal === 'routine_skipped')
      const completedRoutines = recentSignals.filter(s => s.signal === 'routine_completed')

      // ── Rule 1: Chronotype Detection ────────────────────────────────────────
      if (focusSessions.length >= 5) {
        const morningCount = focusSessions.filter(s => (s.hour ?? 0) < 10).length
        const nightCount = focusSessions.filter(s => (s.hour ?? 0) >= 20).length
        const ratio = focusSessions.length

        const prevChronotype = currentEnergy.chronotype as string || ''

        if (morningCount / ratio >= 0.70) {
          if (prevChronotype !== 'morning_lark') {
            newEnergy = { ...newEnergy, chronotype: 'morning_lark' }
            logs.push({
              changeType: 'chronotype_updated',
              description: `Morning lark pattern detected (${Math.round(morningCount / ratio * 100)}% of focus sessions before 10am)`,
              prevValue: prevChronotype,
              newValue: 'morning_lark',
            })
            patternBonus += 3
          }
        } else if (nightCount / ratio >= 0.70) {
          if (prevChronotype !== 'night_owl') {
            newEnergy = { ...newEnergy, chronotype: 'night_owl' }
            logs.push({
              changeType: 'chronotype_updated',
              description: `Night owl pattern detected (${Math.round(nightCount / ratio * 100)}% of focus sessions after 8pm)`,
              prevValue: prevChronotype,
              newValue: 'night_owl',
            })
            patternBonus += 3
          }
        }
      }

      // ── Rule 2: Peak Performance Window ─────────────────────────────────────
      if (focusSessions.length >= 6) {
        // Group sessions by 3-hour windows, find highest completion density
        const windows: Record<number, number> = {}
        for (const s of focusSessions) {
          const windowStart = Math.floor((s.hour ?? 0) / 3) * 3
          windows[windowStart] = (windows[windowStart] ?? 0) + 1
        }
        const [peakWindowStart, peakCount] = Object.entries(windows)
          .sort(([, a], [, b]) => b - a)[0]
        const peakRatio = peakCount / focusSessions.length

        if (peakRatio >= 0.45) {
          const startHour = parseInt(peakWindowStart)
          const endHour = (startHour + 3) % 24

          const prevStart = currentEnergy.peakFocusStart as string || ''
          const newStart = hourToTime(startHour)
          const newEnd = hourToTime(endHour)

          if (prevStart !== newStart) {
            newEnergy = { ...newEnergy, peakFocusStart: newStart, peakFocusEnd: newEnd }
            logs.push({
              changeType: 'peak_window_detected',
              description: `Peak Performance Window detected: ${newStart}–${newEnd} (${Math.round(peakRatio * 100)}% of deep work sessions)`,
              prevValue: prevStart || 'none',
              newValue: `${newStart}–${newEnd}`,
            })
            patternBonus += 3
          }
        }
      }

      // ── Rule 3: Procrastination Pattern ─────────────────────────────────────
      {
        const sevenDaySignals = recentSignals.filter(s => {
          const since = new Date()
          since.setDate(since.getDate() - 7)
          return s.occurredAt >= since
        })
        const recentDeferred = sevenDaySignals.filter(s => s.signal === 'task_deferred').length

        if (recentDeferred >= 3) {
          const prev = currentBottlenecks.mainFrictionPoint as FrictionPoint || ''
          if (prev !== 'procrastination') {
            newBottlenecks = { ...newBottlenecks, mainFrictionPoint: 'procrastination' }
            logs.push({
              changeType: 'friction_detected',
              description: `Procrastination pattern: ${recentDeferred} task deferrals in 7 days`,
              prevValue: prev,
              newValue: 'procrastination',
            })
            patternBonus += 3
          }
        }
      }

      // ── Rule 4: Context Switching ────────────────────────────────────────────
      {
        // Group focus sessions by day, check for micro-sessions
        const today = new Date().toDateString()
        const todayFocusSessions = recentSignals.filter(s =>
          s.signal === 'focus_finished' &&
          new Date(s.occurredAt).toDateString() === today &&
          (s.duration ?? 0) < 15
        )

        if (todayFocusSessions.length >= 4) {
          const prev = currentBottlenecks.mainFrictionPoint as FrictionPoint || ''
          if (prev !== 'context_switching') {
            newBottlenecks = { ...newBottlenecks, mainFrictionPoint: 'context_switching' }
            logs.push({
              changeType: 'friction_detected',
              description: `Context switching: ${todayFocusSessions.length} short focus sessions (<15 min) today`,
              prevValue: prev,
              newValue: 'context_switching',
            })
            patternBonus += 3
          }
        }
      }

      // ── Rule 5: Overcommitment ───────────────────────────────────────────────
      {
        const sevenDayCreated = recentSignals.filter(s => {
          const since = new Date()
          since.setDate(since.getDate() - 7)
          return s.signal === 'task_created' && s.occurredAt >= since
        }).length

        const sevenDayCompleted = recentSignals.filter(s => {
          const since = new Date()
          since.setDate(since.getDate() - 7)
          return s.signal === 'task_completed' && s.occurredAt >= since
        }).length

        if (sevenDayCreated >= 8 && sevenDayCompleted / sevenDayCreated < 0.3) {
          const prev = currentBottlenecks.mainFrictionPoint as FrictionPoint || ''
          if (prev !== 'overcommitment') {
            newBottlenecks = { ...newBottlenecks, mainFrictionPoint: 'overcommitment' }
            logs.push({
              changeType: 'friction_detected',
              description: `Overcommitment: ${sevenDayCreated} tasks created vs ${sevenDayCompleted} completed (${Math.round(sevenDayCompleted / sevenDayCreated * 100)}% ratio)`,
              prevValue: prev,
              newValue: 'overcommitment',
            })
            patternBonus += 3
          }
        }
      }

      // ── Rule 6: Decision Fatigue (afternoon deferral cluster) ────────────────
      {
        const afternoonDeferrals = deferredSignals.filter(s => {
          const h = s.hour ?? 0
          return h >= 14 && h <= 16
        }).length

        if (afternoonDeferrals >= 3) {
          const prev = currentMetrics.decisionFatigueRisk as DecisionFatigueRisk || 'low'
          const newRisk: DecisionFatigueRisk = afternoonDeferrals >= 6 ? 'high' : 'moderate'
          if (prev !== newRisk) {
            newMetrics = { ...newMetrics, decisionFatigueRisk: newRisk }
            logs.push({
              changeType: 'decision_fatigue_raised',
              description: `Decision fatigue detected: ${afternoonDeferrals} deferrals in the 2-4pm window`,
              prevValue: prev,
              newValue: newRisk,
            })
          }
        }
      }

      // ── Rule 7: Burnout Risk ─────────────────────────────────────────────────
      {
        // High focus today + multiple days without routine completion
        const todayFocusMins = recentSignals
          .filter(s => s.signal === 'focus_finished' && new Date(s.occurredAt).toDateString() === new Date().toDateString())
          .reduce((sum, s) => sum + (s.duration ?? 0), 0)

        const last3DayDates = Array.from({ length: 3 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - i)
          return d.toDateString()
        })

        const recentRoutineCompletionDays = new Set(
          completedRoutines.map(s => new Date(s.occurredAt).toDateString())
        )

        const daysWithoutRoutine = last3DayDates.filter(d => !recentRoutineCompletionDays.has(d)).length

        if (todayFocusMins > 300 && daysWithoutRoutine >= 3) {
          const prevBurnout = (currentMetrics.burnoutIndex as number) || 0
          const newBurnout = Math.min(100, prevBurnout + 15)
          newMetrics = { ...newMetrics, burnoutIndex: newBurnout }
          logs.push({
            changeType: 'burnout_risk_raised',
            description: `Burnout risk elevated: ${todayFocusMins}min focus today, ${daysWithoutRoutine} days without routine`,
            prevValue: String(prevBurnout),
            newValue: String(newBurnout),
          })
        }
      }

      // ── Rule 8: Cognitive Load ───────────────────────────────────────────────
      {
        const threeDayCreated = recentSignals.filter(s => {
          const since = new Date()
          since.setDate(since.getDate() - 3)
          return s.signal === 'task_created' && s.occurredAt >= since
        }).length

        if (threeDayCreated > 10) {
          const prevLoad = (currentMetrics.currentCognitiveLoad as number) || 30
          const newLoad = Math.min(100, prevLoad + 10)
          newMetrics = { ...newMetrics, currentCognitiveLoad: newLoad }
        }
      }

      return { newEnergy, newBottlenecks, newMetrics, logs, patternBonus }
    })

    // ── Step 5: Calculate new confidence + trustLevel ────────────────────────
    const newConfidence = await step.run('update-confidence', async () => {
      const prev = twin.confidenceScore
      const gain = confidenceGainPerSignal(prev) + changes.patternBonus
      return Math.min(100, +(prev + gain).toFixed(2))
    })

    const newTrustLevel = deriveTrustLevel(newConfidence)

    // ── Step 6: Persist updated twin ─────────────────────────────────────────
    await step.run('persist-twin', async () => {
      const prevTrust = twin.trustLevel as TrustLevel
      const trustUpgraded = newTrustLevel !== prevTrust

      await prisma.cognitiveTwinRecord.update({
        where: { id: twin.id },
        data: {
          confidenceScore: newConfidence,
          trustLevel: newTrustLevel,
          energyCurve: changes.newEnergy as object,
          bottlenecks: changes.newBottlenecks as object,
          metrics: changes.newMetrics as object,
          totalSignals: { increment: 1 },
        },
      })

      // Write all inference logs
      if (changes.logs.length > 0) {
        await prisma.twinEvolutionLog.createMany({
          data: changes.logs.map(l => ({
            twinId: twin.id,
            userId,
            changeType: l.changeType,
            description: l.description,
            prevValue: l.prevValue ?? null,
            newValue: l.newValue ?? null,
          })),
        })
      }

      // Log trust level upgrade
      if (trustUpgraded) {
        await prisma.twinEvolutionLog.create({
          data: {
            twinId: twin.id,
            userId,
            changeType: 'trust_level_up',
            description: `Trust level upgraded: ${prevTrust} → ${newTrustLevel} (confidence: ${newConfidence.toFixed(1)}%)`,
            prevValue: prevTrust,
            newValue: newTrustLevel,
          },
        })
      }
    })

    // ── Step 7: Daily Snapshot (idempotent — one per day) ────────────────────
    await step.run('write-daily-snapshot', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const energy = changes.newEnergy as Record<string, unknown>
      const bottlenecks = changes.newBottlenecks as Record<string, unknown>
      const metrics = changes.newMetrics as Record<string, unknown>

      try {
        await prisma.twinSnapshot.upsert({
          where: { twinId_snapshotDate: { twinId: twin.id, snapshotDate: today } },
          create: {
            twinId: twin.id,
            userId,
            confidenceScore: newConfidence,
            trustLevel: newTrustLevel,
            cognitiveLoad: (metrics.currentCognitiveLoad as number) ?? 30,
            burnoutIndex: (metrics.burnoutIndex as number) ?? 0,
            chronotype: (energy.chronotype as string) ?? '',
            mainFrictionPoint: (bottlenecks.mainFrictionPoint as string) ?? '',
            peakFocusStart: (energy.peakFocusStart as string) ?? '',
            peakFocusEnd: (energy.peakFocusEnd as string) ?? '',
            totalSignals: (twin.totalSignals ?? 0) + 1,
            snapshotDate: today,
          },
          update: {
            confidenceScore: newConfidence,
            trustLevel: newTrustLevel,
            cognitiveLoad: (metrics.currentCognitiveLoad as number) ?? 30,
            burnoutIndex: (metrics.burnoutIndex as number) ?? 0,
            chronotype: (energy.chronotype as string) ?? '',
            mainFrictionPoint: (bottlenecks.mainFrictionPoint as string) ?? '',
            peakFocusStart: (energy.peakFocusStart as string) ?? '',
            peakFocusEnd: (energy.peakFocusEnd as string) ?? '',
            totalSignals: (twin.totalSignals ?? 0) + 1,
          },
        })
      } catch {
        // Snapshot failure is non-critical
      }
    })

    // ── Step 8: Push real-time SSE event to connected client ─────────────────
    // Non-critical — fire and forget. Works on single-instance deployments.
    // On multi-instance (Vercel serverless), use Redis pub/sub instead.
    await step.run('push-realtime-event', async () => {
      const webhookSecret = process.env.EVENTS_WEBHOOK_SECRET
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      if (!webhookSecret) return

      try {
        await fetch(`${baseUrl}/api/events/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': webhookSecret,
          },
          body: JSON.stringify({
            userId,
            type: 'twin.updated',
            payload: {
              signal,
              confidenceScore: newConfidence,
              trustLevel: newTrustLevel,
              patternsDetected: changes.logs.length,
            },
          }),
        })
      } catch { /* non-critical */ }
    })

    return {
      success: true,
      signal,
      newConfidence,
      newTrustLevel,
      patternsDetected: changes.logs.length,
    }
}

// ─── Inngest registration (used only if INNGEST_* keys are configured) ───────
export const processTwinSignal = inngest.createFunction(
  { id: 'process-twin-signal', concurrency: { key: 'event.data.userId', limit: 1 } },
  { event: 'twin.signal' },
  processTwinSignalHandler
)
