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
import { useFocusControls } from '@/lib/focus-context'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import type { CognitivePhase } from '@/lib/cognitive-engine'
import type { TwinInsight } from '@/lib/cognitive/insight-types'
import { emitTwinNotification } from '@/components/ContextHub'

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
  insight: TwinInsight | null
}

const TWIN_EVOLUTION_SEEN_KEY = 'novo-last-twin-insight-id'
const TWIN_EVOLUTION_POLL_MS = 30_000

// ─── Orchestrator Hook ────────────────────────────────────────────────────────

export function usePeakTaskOrchestrator() {
  const { bioState } = useCognitiveEngine()
  const router = useRouter()
  const { addTask, setSelectedTaskId, setMode } = useFocusControls()
  const { twin } = useCognitiveTwin()
  const twinUserId = twin?.userId || null

  const [state, setState] = useState<OrchestratorState>({
    focusQueue: [],
    isOrchestrating: false,
    currentPhase: null,
    lastPhase: null,
    insight: null,
  })

  const lastPhaseRef = useRef<CognitivePhase | null>(null)
  const orchestrationLockRef = useRef(false)
  const orchestrationUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(false)
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
    if (!isMountedRef.current) return
    setState(s => {
      if (s.insight?.action && !next.action) return s
      return { ...s, insight: next }
    })

    // Route insight directly to ContextHub for Sileo vertical shape morphing
    emitTwinNotification({
      title: next.message,
      description: next.action ? 'Peak Focus window open. Tap to start guided execution.' : 'Twin Engine Update',
      platform: 'twin',
      severity: next.tone === 'critical' ? 'critical' : next.tone === 'warning' ? 'warning' : 'info',
      actionLabel: next.action?.label,
      actionUrl: '/focus',
    })
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (orchestrationUnlockTimerRef.current) {
        clearTimeout(orchestrationUnlockTimerRef.current)
        orchestrationUnlockTimerRef.current = null
      }
    }
  }, [])

  // ── Pull top tasks when entering PEAK_FOCUS ──────────────────────────────

  const pullPeakFocusTasks = useCallback(async () => {
    if (orchestrationLockRef.current) return
    orchestrationLockRef.current = true
    setState(s => ({ ...s, isOrchestrating: true }))

    try {
      const res = await fetch('/api/tasks?status=todo&priority=high&limit=5', { cache: 'no-store' })
      if (!res.ok) return

      const tasks = await res.json()
      if (!isMountedRef.current) return
      if (!Array.isArray(tasks)) return
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
            if (!isMountedRef.current) return
            const planTasks: FocusTask[] = (Array.isArray(plan?.tasks) ? plan.tasks : []).map((t: any) => ({
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
        } catch {
          console.error('[Orchestrator] Continuous day-plan generation failed.')
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
      if (!isMountedRef.current) {
        orchestrationLockRef.current = false
        return
      }
      setState(s => ({ ...s, isOrchestrating: false }))
      if (orchestrationUnlockTimerRef.current) clearTimeout(orchestrationUnlockTimerRef.current)
      orchestrationUnlockTimerRef.current = setTimeout(() => {
        orchestrationLockRef.current = false
        orchestrationUnlockTimerRef.current = null
      }, 60_000) // 1 min lock
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

  // ── Ambient "Twin evolution" feed ─────────────────────────────────────────
  // The evolution feed is optional ambient context, so it should not compete
  // with the first route render or open a network request immediately.
  useEffect(() => {
    if (!twinUserId) return
    const seenKey = TWIN_EVOLUTION_SEEN_KEY + ':' + twinUserId
    let lastSeenId: string | null =
      typeof window !== 'undefined' ? localStorage.getItem(seenKey) : null

    let active = true
    let controller: AbortController | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let warmupTimer: ReturnType<typeof setTimeout> | null = null

    const checkTwinEvolution = async () => {
      if (!active || document.visibilityState === 'hidden') return
      controller?.abort()
      controller = new AbortController()
      try {
        const res = await fetch('/api/cognitive/decisions', { cache: 'no-store', signal: controller.signal })
        if (!res.ok) return
        const payload = await res.json()
        const entries: { id: string; changeType: string; description: string }[] = Array.isArray(payload) ? payload : []
        const latest = entries.find(e => e.changeType !== 'ai_action')
        if (!latest) return

        if (lastSeenId && latest.id !== lastSeenId) {
          pushInsight({ id: latest.id, message: latest.description, tone: 'info' })
        }
        lastSeenId = latest.id
        localStorage.setItem(seenKey, latest.id)
      } catch (error: unknown) {
        if ((error as { name?: string })?.name === 'AbortError') return
        // Ambient context is optional; keep failures off the interaction path.
      }
    }

    const startPolling = () => {
      if (!active || document.visibilityState === 'hidden' || interval !== null) return
      void checkTwinEvolution()
      interval = setInterval(() => void checkTwinEvolution(), TWIN_EVOLUTION_POLL_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (warmupTimer !== null) {
          clearTimeout(warmupTimer)
          warmupTimer = null
        }
        startPolling()
      } else if (interval !== null) {
        clearInterval(interval)
        interval = null
        controller?.abort()
      }
    }

    warmupTimer = setTimeout(() => {
      warmupTimer = null
      startPolling()
    }, 2500)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      active = false
      controller?.abort()
      if (warmupTimer !== null) clearTimeout(warmupTimer)
      if (interval !== null) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pushInsight, twinUserId])

  return {
    focusQueue: state.focusQueue,
    isOrchestrating: state.isOrchestrating,
    currentPhase: state.currentPhase,
    insight: state.insight,
    /** Manually re-trigger peak task pull */
    refresh: pullPeakFocusTasks,
    /** Dismiss current insight */
    dismissInsight: () => setState(s => ({ ...s, insight: null })),
  }
}
