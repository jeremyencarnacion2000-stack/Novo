'use client'

/**
 * usePeakTaskOrchestrator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * A React hook that acts as Novo's "Proactive Brain" — it watches the
 * cognitive phase and autonomously orchestrates task visibility.
 *
 * Behaviors:
 *  • PEAK_FOCUS detected → pulls top-priority pending tasks into a
 *    "focus queue" and dispatches a `cognitive:peak-focus-started` event
 *  • SYNAPTIC_FATIGUE detected → defers low-priority tasks, dispatches
 *    `cognitive:recovery-started` event, auto-queues breathing
 *  • Generates and persists an Insight when burnout risk is high
 *
 * Usage:
 *   const { focusQueue, isOrchestrating } = usePeakTaskOrchestrator()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import type { CognitivePhase } from '@/lib/cognitive-engine'
import type { BurnoutPrediction } from '@/lib/cognitive-memory'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FocusTask {
  id: string
  title: string
  priority: string
  projectName?: string
  estimatedMinutes?: number
}

interface OrchestratorState {
  focusQueue: FocusTask[]
  isOrchestrating: boolean
  currentPhase: CognitivePhase | null
  lastPhase: CognitivePhase | null
  burnoutRisk: BurnoutPrediction['risk'] | null
  insightMessage: string | null
}

// ─── Orchestrator Hook ────────────────────────────────────────────────────────

export function usePeakTaskOrchestrator() {
  const { bioState } = useCognitiveEngine()

  const [state, setState] = useState<OrchestratorState>({
    focusQueue: [],
    isOrchestrating: false,
    currentPhase: null,
    lastPhase: null,
    burnoutRisk: null,
    insightMessage: null,
  })

  const lastPhaseRef = useRef<CognitivePhase | null>(null)
  const orchestrationLockRef = useRef(false)

  // ── Pull top tasks when entering PEAK_FOCUS ──────────────────────────────

  const pullPeakFocusTasks = useCallback(async () => {
    if (orchestrationLockRef.current) return
    orchestrationLockRef.current = true
    setState(s => ({ ...s, isOrchestrating: true }))

    try {
      const res = await fetch('/api/tasks?status=todo&priority=high&limit=5')
      if (!res.ok) return

      const tasks = await res.json()
      const queue: FocusTask[] = tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        projectName: t.project?.title,
        estimatedMinutes: 25, // Default Pomodoro slot
      }))

      setState(s => ({
        ...s,
        focusQueue: queue,
        insightMessage:
          queue.length > 0
            ? `🧠 Peak Focus detected. ${queue.length} high-priority task${queue.length !== 1 ? 's' : ''} queued for this window.`
            : '🧠 Peak Focus window open. No high-priority tasks pending.',
      }))

      // Global event: other components (Today view, sidebar) can react
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cognitive:peak-focus-started', {
            detail: { queue, attentionScore: bioState?.attentionScore },
          })
        )
      }
    } finally {
      setState(s => ({ ...s, isOrchestrating: false }))
      setTimeout(() => { orchestrationLockRef.current = false }, 60_000) // 1 min lock
    }
  }, [bioState?.attentionScore])

  // ── Defer low-priority tasks when entering SYNAPTIC_FATIGUE ──────────────

  const handleRecoveryMode = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cognitive:recovery-started', {
          detail: {
            minutesToNextPhase: bioState?.minutesToNextPhase,
            recommendedAudio: bioState?.recommendedAudioCategory,
          },
        })
      )
    }

    setState(s => ({
      ...s,
      focusQueue: [],
      insightMessage:
        `⚠️ Cognitive fatigue detected. ` +
        `Recovery recommended (~${bioState?.minutesToNextPhase ?? 20} min). ` +
        `Low-priority tasks hidden until next window.`,
    }))

    // Persist insight to DB (fire-and-forget)
    try {
      await fetch('/api/cognitive/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fatigue',
          content:
            `Synaptic fatigue detected at ${new Date().toLocaleTimeString()}. ` +
            `Fatigue score: ${bioState?.fatigueScore}%. ` +
            `Attention at ${bioState?.attentionScore}%. Recovery block recommended.`,
        }),
      })
    } catch {
      // Non-critical — insight persistence is best-effort
    }
  }, [bioState])

  // ── Phase transition watcher ──────────────────────────────────────────────

  useEffect(() => {
    if (!bioState) return

    const currentPhase = bioState.phase
    const lastPhase = lastPhaseRef.current

    // Only act on phase TRANSITIONS, not every render
    if (currentPhase === lastPhase) return

    lastPhaseRef.current = currentPhase

    setState(s => ({
      ...s,
      currentPhase,
      lastPhase,
    }))

    if (
      currentPhase === 'PEAK_FOCUS' &&
      lastPhase !== 'PEAK_FOCUS'
    ) {
      pullPeakFocusTasks()
    }

    if (
      (currentPhase === 'SYNAPTIC_FATIGUE' || currentPhase === 'REDUCED_CAPACITY_MODE') &&
      lastPhase === 'PEAK_FOCUS'
    ) {
      handleRecoveryMode()
    }
  }, [bioState, pullPeakFocusTasks, handleRecoveryMode])

  // ── Burnout check (runs once on mount, then every 10 min) ────────────────

  useEffect(() => {
    const checkBurnout = async () => {
      try {
        const res = await fetch('/api/cognitive/patterns')
        if (!res.ok) return

        const profile = await res.json()
        const risk: BurnoutPrediction['risk'] = profile?.burnoutPrediction?.risk ?? 'none'

        setState(s => ({ ...s, burnoutRisk: risk }))

        if (risk === 'high' || risk === 'critical') {
          setState(s => ({
            ...s,
            insightMessage:
              risk === 'critical'
                ? '🚨 Critical burnout trajectory. Take a recovery day. Non-essential tasks deferred.'
                : '⚠️ High burnout risk over the last 7 days. Schedule a lighter load today.',
          }))
        }
      } catch {
        // Non-critical
      }
    }

    checkBurnout()
    const interval = setInterval(checkBurnout, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return {
    focusQueue: state.focusQueue,
    isOrchestrating: state.isOrchestrating,
    currentPhase: state.currentPhase,
    burnoutRisk: state.burnoutRisk,
    insightMessage: state.insightMessage,
    /** Manually re-trigger peak task pull */
    refresh: pullPeakFocusTasks,
    /** Dismiss current insight */
    dismissInsight: () => setState(s => ({ ...s, insightMessage: null })),
  }
}
