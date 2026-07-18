'use client'

/**
 * usePeakTaskOrchestrator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * A React hook that acts as Novo's "Proactive Brain" — it watches the
 * cognitive phase and autonomously orchestrates task visibility, and is the
 * single place that produces the unified `TwinInsight` shown to the user
 * (see lib/cognitive/insight-types.ts).
 *
 * Behaviors:
 *  • PEAK_FOCUS detected → pulls top-priority pending tasks into a
 *    "focus queue", dispatches `cognitive:peak-focus-started`, and surfaces
 *    an insight with a real "Empezar ahora" action that hands the top task
 *    straight to the Focus page.
 *  • SYNAPTIC_FATIGUE detected → defers low-priority tasks, dispatches
 *    `cognitive:recovery-started`, and surfaces an insight with a real
 *    "Iniciar descanso" action that switches the Focus timer to break mode.
 *  • Generates an insight when burnout risk is high (no action — see
 *    pushInsight below for why some insights are FYI-only).
 *  • Polls /api/cognitive/decisions for ambient "Twin evolution" entries
 *    (was a second, uncoordinated toast surface — components/cognitive/
 *    twin-insight-toast.tsx — now folded in here, see the comment above the
 *    polling effect for why).
 *
 * Usage:
 *   const { focusQueue, insight, dismissInsight } = usePeakTaskOrchestrator()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCognitiveEngine } from '@/lib/cognitive-context'
import { useFocus } from '@/lib/focus-context'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import type { CognitivePhase } from '@/lib/cognitive-engine'
import type { BurnoutPrediction } from '@/lib/cognitive-memory'
import type { TwinInsight } from '@/lib/cognitive/insight-types'

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
  insight: TwinInsight | null
}

const TWIN_EVOLUTION_SEEN_KEY = 'novo-last-twin-insight-id'
const TWIN_EVOLUTION_POLL_MS = 30_000

// ─── Orchestrator Hook ────────────────────────────────────────────────────────

export function usePeakTaskOrchestrator() {
  const { bioState } = useCognitiveEngine()
  const router = useRouter()
  const { addTask, setSelectedTaskId, setMode } = useFocus()
  const { twin } = useCognitiveTwin()

  const [state, setState] = useState<OrchestratorState>({
    focusQueue: [],
    isOrchestrating: false,
    currentPhase: null,
    lastPhase: null,
    burnoutRisk: null,
    insight: null,
  })

  const lastPhaseRef = useRef<CognitivePhase | null>(null)
  const orchestrationLockRef = useRef(false)
  // The very first bioState read on mount always looks like a "transition"
  // (lastPhaseRef starts null), which fired the Peak Focus / recovery
  // insight on every single page load whenever the user simply happened to
  // already be inside that window — not just on a genuine live transition
  // into it during an already-open session. This flag lets that first read
  // silently set the baseline instead.
  const hasSeenFirstPhaseRef = useRef(false)

  // Replaces whatever insight is currently showing — except an ambient,
  // action-less insight (the DB-polled "Twin evolution" feed) is never
  // allowed to bump one the user hasn't acted on yet. Without this guard,
  // folding the DB feed into the same slot would recreate the exact
  // "two things fighting for attention" bug this refactor exists to fix,
  // just inside one hook instead of two components.
  // ponytail: a single guard, not a priority queue — add real ordering only
  // if a third insight source shows up and this stops being enough.
  const pushInsight = useCallback((next: TwinInsight) => {
    setState(s => {
      if (s.insight?.action && !next.action) return s
      return { ...s, insight: next }
    })
  }, [])

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

      let finalQueue = queue

      if (queue.length > 0) {
        setState(s => ({ ...s, focusQueue: queue }))
        pushInsight({
          id: `peak-focus-${Date.now()}`,
          message: `🧠 Peak Focus detected. ${queue.length} high-priority task${queue.length !== 1 ? 's' : ''} queued for this window.`,
          tone: 'info',
          action: {
            label: 'Empezar ahora',
            onClick: () => {
              // The Focus page has no route param for handing it an external
              // queue, so the lowest-risk hand-off is through the same
              // FocusProvider the Focus page itself reads from: seed the top
              // queued task (with its real backend id, so it's the same task
              // everywhere — analytics, /checklist, etc.) as a focus-session
              // task, select it explicitly, then navigate there.
              const top = queue[0]
              addTask(top.title, top.id)
              setSelectedTaskId(top.id)
              router.push('/focus')
            },
          },
        })
      } else {
        // Empty queue is the same "nothing to guide me right now" moment the
        // onboarding Day 1 plan exists to solve — so solve it the same way,
        // continuously: generate and actually create a calibrated plan
        // instead of just reporting there's nothing pending. This is what
        // makes the Twin feel like it's always working, not a one-time
        // onboarding trick.
        setState(s => ({ ...s, focusQueue: [] }))
        try {
          const planRes = await fetch('/api/onboarding/day-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ twin, trigger: 'peak_focus' }),
          })
          if (planRes.ok) {
            const plan = await planRes.json()
            const planTasks: FocusTask[] = (plan.tasks || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              priority: t.priority,
              estimatedMinutes: 25,
            }))
            if (planTasks.length > 0) {
              finalQueue = planTasks
              setState(s => ({ ...s, focusQueue: planTasks }))
              pushInsight({
                id: `peak-focus-generated-${Date.now()}`,
                message: `🧠 Peak Focus detected. No tenías tareas pendientes — generé un plan calibrado a tu meta.`,
                tone: 'info',
                action: {
                  label: 'Empezar ahora',
                  onClick: () => {
                    const top = planTasks[0]
                    addTask(top.title, top.id)
                    setSelectedTaskId(top.id)
                    router.push('/focus')
                  },
                },
              })
            } else {
              pushInsight({
                id: `peak-focus-empty-${Date.now()}`,
                message: '🧠 Peak Focus window open. No high-priority tasks pending.',
                tone: 'info',
              })
            }
          } else {
            pushInsight({
              id: `peak-focus-empty-${Date.now()}`,
              message: '🧠 Peak Focus window open. No high-priority tasks pending.',
              tone: 'info',
            })
          }
        } catch (error) {
          console.error('[Orchestrator] Continuous day-plan generation failed:', error)
          pushInsight({
            id: `peak-focus-empty-${Date.now()}`,
            message: '🧠 Peak Focus window open. No high-priority tasks pending.',
            tone: 'info',
          })
        }
      }

      // Global event: other components (Today view, sidebar) can react.
      // Uses finalQueue, not queue — when the fetched queue was empty and a
      // plan got generated instead, listeners should see what's actually
      // queued now, not the empty snapshot from before generation.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cognitive:peak-focus-started', {
            detail: { queue: finalQueue, attentionScore: bioState?.attentionScore },
          })
        )
      }
    } finally {
      setState(s => ({ ...s, isOrchestrating: false }))
      setTimeout(() => { orchestrationLockRef.current = false }, 60_000) // 1 min lock
    }
  }, [bioState?.attentionScore, pushInsight, addTask, setSelectedTaskId, router, twin])

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

    setState(s => ({ ...s, focusQueue: [] }))

    pushInsight({
      id: `synaptic-fatigue-${Date.now()}`,
      message:
        `⚠️ Cognitive fatigue detected. ` +
        `Recovery recommended (~${bioState?.minutesToNextPhase ?? 20} min). ` +
        `Low-priority tasks hidden until next window.`,
      tone: 'warning',
      action: {
        label: 'Iniciar descanso',
        onClick: () => {
          // Real action, not just a dismiss: switches the Focus timer to
          // break mode (resets its clock to the active profile's break
          // duration) and takes the user there to hit Start — same
          // mechanism the Focus page's own break button uses.
          setMode('shortBreak')
          router.push('/focus')
        },
      },
    })

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
  }, [bioState, pushInsight, setMode, router])

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

    // First read this session — record the baseline phase, don't treat
    // "arrived already inside a window" as a transition into it.
    if (!hasSeenFirstPhaseRef.current) {
      hasSeenFirstPhaseRef.current = true
      return
    }

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
          // FYI only, deliberately no action — "take a lighter day" isn't a
          // one-tap operation Novo can perform on the user's behalf.
          pushInsight({
            id: `burnout-${risk}-${Date.now()}`,
            message:
              risk === 'critical'
                ? '🚨 Critical burnout trajectory. Take a recovery day. Non-essential tasks deferred.'
                : '⚠️ High burnout risk over the last 7 days. Schedule a lighter load today.',
            tone: risk === 'critical' ? 'critical' : 'warning',
          })
        }
      } catch {
        // Non-critical
      }
    }

    checkBurnout()
    const interval = setInterval(checkBurnout, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [pushInsight])

  // ── Ambient "Twin evolution" feed ─────────────────────────────────────────
  // Was its own component (components/cognitive/twin-insight-toast.tsx)
  // polling the same /api/cognitive/decisions endpoint and firing a
  // separate toast() popup. Folded in here because there's no meaningful
  // distinction for the user between "the twin noticed something during
  // this live session" (the phase-transition insights above) and "the twin
  // noticed something and wrote it to TwinEvolutionLog" — both are just the
  // twin telling you what it saw, so both now go through the same `insight`
  // slot instead of two competing UI surfaces. pushInsight's guard keeps
  // this ambient, action-less feed from stomping an actionable insight.
  useEffect(() => {
    let lastSeenId: string | null =
      typeof window !== 'undefined' ? localStorage.getItem(TWIN_EVOLUTION_SEEN_KEY) : null

    const checkTwinEvolution = async () => {
      try {
        const res = await fetch('/api/cognitive/decisions')
        if (!res.ok) return
        const entries: { id: string; changeType: string; description: string }[] = await res.json()
        // ai_action entries are a different signal (the Bitácora's execution
        // trail), not a Twin "insight" — same exclusion the old toast used.
        const latest = entries.find(e => e.changeType !== 'ai_action')
        if (!latest) return

        // First poll just baselines the last-seen id so existing history
        // doesn't dump a wall of insights on load.
        if (lastSeenId && latest.id !== lastSeenId) {
          pushInsight({ id: latest.id, message: latest.description, tone: 'info' })
        }
        lastSeenId = latest.id
        localStorage.setItem(TWIN_EVOLUTION_SEEN_KEY, latest.id)
      } catch {
        // ponytail: silent — ambient nicety, not a critical path
      }
    }

    checkTwinEvolution()
    const interval = setInterval(checkTwinEvolution, TWIN_EVOLUTION_POLL_MS)
    return () => clearInterval(interval)
  }, [pushInsight])

  return {
    focusQueue: state.focusQueue,
    isOrchestrating: state.isOrchestrating,
    currentPhase: state.currentPhase,
    burnoutRisk: state.burnoutRisk,
    insight: state.insight,
    /** Manually re-trigger peak task pull */
    refresh: pullPeakFocusTasks,
    /** Dismiss current insight */
    dismissInsight: () => setState(s => ({ ...s, insight: null })),
  }
}
