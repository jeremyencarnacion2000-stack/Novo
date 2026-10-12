'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toCognitiveTwinSyncPayload } from '@/lib/cognitive-twin-sync'

export type TrustLevel = 'initial' | 'learning' | 'adapted' | 'validated'

export interface CognitiveTwin {
  userId: string
  updatedAt: string
  version: number
  isInitialized: boolean
  onboardingCompletedAt: string | null   // First-class persisted event — never null after onboarding
  confidenceScore: number
  trustLevel: TrustLevel
  longTermGoal: string   // free-text 12-month goal captured during onboarding; '' for pre-existing users

  identity: {
    role: 'student' | 'founder' | 'developer' | 'creator' | 'professional' | ''
    industry: string
    focusStyle: 'deep_builder' | 'reactive_communicator' | 'frantic_juggler' | 'consistent_planner' | ''
    deepWorkCapacity: number
    adaptationPolicy?: {
      proposals: Array<{ id: string; reason: string; behavior: string }>
      updatedAt: string
    }
  }

  energyCurve: {
    chronotype: 'morning_lark' | 'night_owl' | 'intermediate' | ''
    peakFocusStart: string
    peakFocusEnd: string
    typicalSlumpHour: number
  }

  metrics: {
    currentCognitiveLoad: number
    decisionFatigueRisk: 'unknown' | 'low' | 'moderate' | 'high' | 'critical'
    burnoutIndex: number
  }

  bottlenecks: {
    mainFrictionPoint: 'context_switching' | 'procrastination' | 'overcommitment' | 'lack_of_structure' | ''
    motivationDrivers: Array<'achievement' | 'urgency' | 'gamification' | 'minimalist_calm'>
    planningPreference: 'adaptive' | 'rigid_timeblocks' | 'reactive_list' | ''
  }

  workspaceLayout: {
    enabledModules: string[]
    pinnedModules?: string[]
    collapsedSidebar: boolean
    heroWidget: string
  }
}

const defaultTwin: CognitiveTwin = {
  userId: '',
  updatedAt: new Date().toISOString(),
  version: 1,
  isInitialized: false,
  onboardingCompletedAt: null,
  // No observed evidence exists before onboarding/activity is recorded.
  confidenceScore: 0,
  trustLevel: 'initial',
  longTermGoal: '',
  identity: { role: '', industry: '', focusStyle: '', deepWorkCapacity: 3.5 },
  energyCurve: { chronotype: '', peakFocusStart: '', peakFocusEnd: '', typicalSlumpHour: 14 },
  // No biometric or behavioural baseline exists before owned data arrives.
  metrics: { currentCognitiveLoad: 0, decisionFatigueRisk: 'unknown', burnoutIndex: 0 },
  bottlenecks: { mainFrictionPoint: '', motivationDrivers: [], planningPreference: '' },
  workspaceLayout: {
    enabledModules: ['today', 'ai', 'cognitive', 'focus'],
    collapsedSidebar: false,
    heroWidget: 'cognitive_twin_orb',
  },
}

interface CognitiveTwinContextType {
  twin: CognitiveTwin
  initializeTwin: (data: Partial<CognitiveTwin>) => Promise<boolean>
  updateTwin: (data: Partial<CognitiveTwin>) => void
  resetTwin: () => Promise<boolean>
  isLoading: boolean
}

const CognitiveTwinContext = createContext<CognitiveTwinContextType | undefined>(undefined)

// Never use one shared browser cache for every account on a device. The Twin
// is private context; a global key could briefly hydrate the previous user's
// snapshot when the server has no record yet (or a request is offline).
function twinCacheKey(userId: string | null | undefined): string | null {
  return userId ? `novo_cognitive_twin:${userId}` : null
}

// ── Merge strategy: SERVER WINS on all core fields.
// workspaceLayout is merged additively (server as base, any extra client-only keys preserved).
// localStorage is never authoritative — it is only used as an offline fallback when the
// server returns null (network failure, first boot before record is created).
function serverToTwin(serverRecord: Record<string, unknown>, fallback: CognitiveTwin): CognitiveTwin {
  return {
    ...fallback,
    userId: (serverRecord.userId as string) ?? fallback.userId,
    updatedAt: (serverRecord.updatedAt as string) ?? fallback.updatedAt,
    version: (serverRecord.version as number) ?? fallback.version,
    isInitialized: (serverRecord.isInitialized as boolean) ?? fallback.isInitialized,
    onboardingCompletedAt: (serverRecord.onboardingCompletedAt as string | null) ?? fallback.onboardingCompletedAt,
    confidenceScore: (serverRecord.confidenceScore as number) ?? fallback.confidenceScore,
    trustLevel: (serverRecord.trustLevel as TrustLevel) ?? fallback.trustLevel,
    longTermGoal: (serverRecord.longTermGoal as string) ?? fallback.longTermGoal,
    identity: {
      ...fallback.identity,
      ...((serverRecord.identity as object) ?? {}),
    },
    energyCurve: {
      ...fallback.energyCurve,
      ...((serverRecord.energyCurve as object) ?? {}),
    },
    metrics: {
      ...fallback.metrics,
      ...((serverRecord.metrics as object) ?? {}),
    },
    bottlenecks: {
      ...fallback.bottlenecks,
      ...((serverRecord.bottlenecks as object) ?? {}),
    },
    // workspaceLayout: server base + any client-only keys (future extensibility)
    workspaceLayout: {
      ...fallback.workspaceLayout,
      ...((serverRecord.workspaceLayout as object) ?? {}),
    },
  }
}

export function CognitiveTwinProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [twin, setTwin] = useState<CognitiveTwin>(defaultTwin)
  const [isLoading, setIsLoading] = useState(true)
  const resetInFlightRef = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)
  // Keep reconciliation cheap: identical server snapshots must not fan out a
  // provider-wide render every polling cycle.
  const twinRef = useRef(twin)
  useEffect(() => {
    twinRef.current = twin
  }, [twin])
  currentUserIdRef.current = session?.user?.id ?? null
  // Invalidates any GET that was started before a reset. Without a generation
  // guard, a slow response could hydrate the old Twin after the reset UI had
  // already moved to the clean state.
  const stateGenerationRef = useRef(0)
  const bootInFlightRef = useRef(false)
  const bootFinishedAtRef = useRef(0)

  // ── Single boot sequence: Server → Provider State → Cache (write-only) ──────
  //
  // Phase 1 (localStorage immediate load) has been intentionally REMOVED.
  // localStorage must never overwrite server state. It is written FROM the server
  // response so subsequent offline reads get a recent snapshot, but it is never
  // read back into state on authenticated sessions.
  //
  // Boot order:
  //   1. Render with defaultTwin (isLoading: true → guards don't fire yet)
  //   2. Wait for session status
  //   3. Fetch server record → server wins unconditionally
  //   4. If server returns null (no record yet) → fall back to localStorage cache
  //   5. isLoading: false → routing guards activate
  useEffect(() => {
    if (status === 'loading') return

    // Invalidate any boot request from the previous session before starting a
    // new one. This matters on account switching: a slow response for user A
    // must never hydrate user B's Twin or end user B's loading state early.
    const generation = ++stateGenerationRef.current

    if (status === 'unauthenticated') {
      bootInFlightRef.current = false
      bootFinishedAtRef.current = Date.now()
      setTwin(defaultTwin)
      setIsLoading(false)
      return
    }

    // status === 'authenticated'
    const userId = session?.user?.id ?? null
    if (!userId) {
      bootInFlightRef.current = false
      bootFinishedAtRef.current = Date.now()
      setTwin(defaultTwin)
      setIsLoading(false)
      return
    }
    // Paint returning users from the last server-confirmed snapshot while the
    // authoritative request is in flight. The generation/user guards below
    // still ensure a late response can never cross account boundaries.
    try {
      const key = twinCacheKey(userId)
      const cached = key ? localStorage.getItem(key) : null
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, unknown>
        if (parsed?.isInitialized) setTwin(serverToTwin(parsed, defaultTwin))
      }
    } catch {}

    const controller = new AbortController()
    let active = true
    async function bootFromServer() {
      const timeout = window.setTimeout(() => controller.abort(), 10_000)
      try {
        const res = await fetch('/api/cognitive-twin/sync', { signal: controller.signal })
        if (res.ok) {
          const { twin: serverTwin } = await res.json()
          if (serverTwin) {
            if (!active || generation !== stateGenerationRef.current || resetInFlightRef.current || currentUserIdRef.current !== userId) return
            // ✅ Server record exists — it is the single source of truth
            const hydrated = serverToTwin(serverTwin, defaultTwin)
            twinRef.current = hydrated
            setTwin(hydrated)
            // Write back to localStorage as a non-authoritative offline cache
            try {
              const key = twinCacheKey(userId)
              if (key) localStorage.setItem(key, JSON.stringify(hydrated))
            } catch {}
            return
          }
        }
        // Server returned null OR request failed — fall back to localStorage cache
        // This is a degraded offline mode only; never treated as authoritative.
        if (!active || generation !== stateGenerationRef.current || resetInFlightRef.current || currentUserIdRef.current !== userId) return
        try {
          const key = twinCacheKey(userId)
          const cached = key ? localStorage.getItem(key) : null
          if (cached) {
            const hydrated = serverToTwin(JSON.parse(cached) as Record<string, unknown>, defaultTwin)
            twinRef.current = hydrated
            setTwin(hydrated)
          }
        } catch {}
      } catch {
        // Network error — try localStorage cache as last resort
        if (!active || generation !== stateGenerationRef.current || resetInFlightRef.current || currentUserIdRef.current !== userId) return
        try {
          const key = twinCacheKey(userId)
          const cached = key ? localStorage.getItem(key) : null
          if (cached) {
            const hydrated = serverToTwin(JSON.parse(cached) as Record<string, unknown>, defaultTwin)
            twinRef.current = hydrated
            setTwin(hydrated)
          }
        } catch {}
      } finally {
        window.clearTimeout(timeout)
        bootInFlightRef.current = false
        bootFinishedAtRef.current = Date.now()
        active = false
        if (generation === stateGenerationRef.current && currentUserIdRef.current === userId && !resetInFlightRef.current) {
          setIsLoading(false)
        }
      }
    }

    setIsLoading(true)
    bootInFlightRef.current = true
    bootFinishedAtRef.current = 0
    void bootFromServer()
    return () => {
      active = false
      controller.abort()
    }
  }, [status, session?.user?.id])

  // Keep all surfaces aligned after an asynchronous Twin inference run. The
  // server remains authoritative; this poll only makes persisted adaptation
  // visible without requiring a full navigation or a second client model.
  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    let timer: number | null = null
    let source: EventSource | null = null
    const refreshInFlight = { current: false }

    const refreshFromServer = async () => {
      if (!active || document.visibilityState === 'hidden' || refreshInFlight.current || resetInFlightRef.current) return
      const generation = stateGenerationRef.current
      refreshInFlight.current = true
      try {
        const response = await fetch('/api/cognitive-twin/sync', { cache: 'no-store' })
        if (!response.ok || !active || generation !== stateGenerationRef.current || resetInFlightRef.current) return
        const payload = await response.json() as { twin?: Record<string, unknown> | null }
        if (payload.twin && active) {
          const hydrated = serverToTwin(payload.twin, defaultTwin)
          const previous = twinRef.current
          const changed = previous.updatedAt !== hydrated.updatedAt
            || previous.version !== hydrated.version
            || previous.confidenceScore !== hydrated.confidenceScore
            || previous.trustLevel !== hydrated.trustLevel
            || previous.isInitialized !== hydrated.isInitialized
          if (changed) {
            twinRef.current = hydrated
            setTwin(hydrated)
          }
          if (changed) {
            try {
              const key = twinCacheKey(currentUserIdRef.current)
              if (key) localStorage.setItem(key, JSON.stringify(hydrated))
            } catch {}
          }
        }
      } catch { /* degraded clients retain their last authoritative snapshot */ }
      finally { refreshInFlight.current = false }
    }

    const connectEvents = () => {
      if (!active || document.visibilityState === 'hidden' || source || typeof EventSource === 'undefined') return
      source = new EventSource('/api/events')
      source.onerror = () => {
        // EventSource is the low-overhead path. If a browser/proxy cannot keep
        // it alive, fall back to a slower poll instead of reconnecting in a
        // tight loop and keeping the shell busy.
        source?.close()
        source = null
        if (active && document.visibilityState === 'visible' && timer === null) {
          timer = window.setInterval(() => void refreshFromServer(), 60_000)
        }
      }
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string }
          if (payload.type === 'twin.updated') {
            void refreshFromServer()
            window.dispatchEvent(new CustomEvent('novo:twin-updated'))
          }
        } catch { /* malformed event cannot invalidate the current Twin */ }
      }
    }

    const stopPolling = () => {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
      source?.close()
      source = null
    }
    const startPolling = () => {
      if (!active || document.visibilityState === 'hidden' || timer !== null) return
      const bootIsFresh = !bootInFlightRef.current && Date.now() - bootFinishedAtRef.current < 3_000
      if (!bootIsFresh) void refreshFromServer()
      connectEvents()
      // EventSource delivers Twin updates immediately. Only browsers without
      // SSE support need a periodic fallback, and it can be deliberately slow.
      if (typeof EventSource === 'undefined') {
        timer = window.setInterval(() => void refreshFromServer(), 60_000)
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }

    // The boot request above is the critical path. Avoid issuing a second
    // identical sync request during the first paint; start live reconciliation
    // once the app has had a moment to become interactive.
    let warmupTimer: number | null = window.setTimeout(() => {
      warmupTimer = null
      startPolling()
    }, 1200)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      if (warmupTimer !== null) window.clearTimeout(warmupTimer)
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [status, session?.user?.id])

  const initializeTwin = async (data: Partial<CognitiveTwin>): Promise<boolean> => {
    const userId = currentUserIdRef.current
    if (!userId) return false
    const now = new Date().toISOString()
    const newTwin: CognitiveTwin = {
      ...defaultTwin,
      ...data,
      isInitialized: true,
      onboardingCompletedAt: now,
      trustLevel: 'initial',
      updatedAt: now,
    }
    setTwin(newTwin)
    try {
      const key = twinCacheKey(userId)
      if (key) localStorage.setItem(key, JSON.stringify(newTwin))
    } catch {}

    // Persist to DB. Not awaited by the caller (onboarding shouldn't block
    // navigation on network conditions), so this was previously truly
    // fire-and-forget despite a comment claiming otherwise — a failure was
    // silent, and the profile survived only via this device's localStorage.
    // One retry closes the common transient-failure case without turning
    // onboarding into a hard network dependency.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch('/api/cognitive-twin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toCognitiveTwinSyncPayload(newTwin)),
        })
        if (response.ok && currentUserIdRef.current === userId) return true
        console.error('[CognitiveTwin] Failed to persist twin:', response.status)
      } catch {
        console.error('[CognitiveTwin] Failed to persist twin: network error')
      }
    }
    return false
  }

  const updateTwin = (data: Partial<CognitiveTwin>) => {
    setTwin(prev => {
      const next = { ...prev, ...data, updatedAt: new Date().toISOString() }
      try {
        const key = twinCacheKey(currentUserIdRef.current)
        if (key) localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const resetTwin = async (): Promise<boolean> => {
    const previousTwin = twin
    const userId = currentUserIdRef.current
    if (!userId) return false
    const resetGeneration = ++stateGenerationRef.current
    resetInFlightRef.current = true
    setTwin(defaultTwin)
    try {
      const key = twinCacheKey(userId)
      if (key) localStorage.removeItem(key)
    } catch {}

    try {
      const response = await fetch('/api/cognitive-twin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
      if (!response.ok) throw new Error(`Reset failed (${response.status})`)
      const payload = await response.json() as { twin?: Record<string, unknown> | null }
      if (!payload.twin) throw new Error('Reset response missing Twin')
      if (resetGeneration !== stateGenerationRef.current || currentUserIdRef.current !== userId) return false
      const hydrated = serverToTwin(payload.twin, defaultTwin)
      setTwin(hydrated)
      try {
        const key = twinCacheKey(userId)
        if (key) localStorage.setItem(key, JSON.stringify(hydrated))
      } catch {}
      window.dispatchEvent(new CustomEvent('novo:twin-reset'))
      return true
    } catch (error) {
      // Keep the UI truthful if the server did not confirm the reset. A stale
      // local reset would otherwise look successful until the next refresh.
      if (resetGeneration === stateGenerationRef.current && currentUserIdRef.current === userId) {
        setTwin(previousTwin)
        try {
          const key = twinCacheKey(userId)
          if (key) localStorage.setItem(key, JSON.stringify(previousTwin))
        } catch {}
      }
      console.error('[CognitiveTwin] Failed to reset twin:', error)
      return false
    } finally {
      resetInFlightRef.current = false
    }
  }

  return (
    <CognitiveTwinContext.Provider value={{ twin, initializeTwin, updateTwin, resetTwin, isLoading }}>
      {children}
    </CognitiveTwinContext.Provider>
  )
}

export function useCognitiveTwin() {
  const context = useContext(CognitiveTwinContext)
  if (!context) throw new Error('useCognitiveTwin must be used within a CognitiveTwinProvider')
  return context
}
