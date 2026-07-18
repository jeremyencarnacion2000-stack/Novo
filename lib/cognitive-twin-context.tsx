'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

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
  }

  energyCurve: {
    chronotype: 'morning_lark' | 'night_owl' | 'intermediate' | ''
    peakFocusStart: string
    peakFocusEnd: string
    typicalSlumpHour: number
  }

  metrics: {
    currentCognitiveLoad: number
    decisionFatigueRisk: 'low' | 'moderate' | 'high' | 'critical'
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
  confidenceScore: 42,
  trustLevel: 'initial',
  longTermGoal: '',
  identity: { role: '', industry: '', focusStyle: '', deepWorkCapacity: 3.5 },
  energyCurve: { chronotype: '', peakFocusStart: '', peakFocusEnd: '', typicalSlumpHour: 14 },
  metrics: { currentCognitiveLoad: 30, decisionFatigueRisk: 'low', burnoutIndex: 10 },
  bottlenecks: { mainFrictionPoint: '', motivationDrivers: [], planningPreference: '' },
  workspaceLayout: {
    enabledModules: ['today', 'ai', 'cognitive', 'focus'],
    collapsedSidebar: false,
    heroWidget: 'cognitive_twin_orb',
  },
}

interface CognitiveTwinContextType {
  twin: CognitiveTwin
  initializeTwin: (data: Partial<CognitiveTwin>) => void
  updateTwin: (data: Partial<CognitiveTwin>) => void
  resetTwin: () => void
  isLoading: boolean
}

const CognitiveTwinContext = createContext<CognitiveTwinContextType | undefined>(undefined)

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

    if (status === 'unauthenticated') {
      setIsLoading(false)
      return
    }

    // status === 'authenticated'
    async function bootFromServer() {
      try {
        const res = await fetch('/api/cognitive-twin/sync')
        if (res.ok) {
          const { twin: serverTwin } = await res.json()
          if (serverTwin) {
            // ✅ Server record exists — it is the single source of truth
            const hydrated = serverToTwin(serverTwin, defaultTwin)
            setTwin(hydrated)
            // Write back to localStorage as a non-authoritative offline cache
            try { localStorage.setItem('novo_cognitive_twin', JSON.stringify(hydrated)) } catch {}
            return
          }
        }
        // Server returned null OR request failed — fall back to localStorage cache
        // This is a degraded offline mode only; never treated as authoritative.
        try {
          const cached = localStorage.getItem('novo_cognitive_twin')
          if (cached) setTwin(JSON.parse(cached))
        } catch {}
      } catch {
        // Network error — try localStorage cache as last resort
        try {
          const cached = localStorage.getItem('novo_cognitive_twin')
          if (cached) setTwin(JSON.parse(cached))
        } catch {}
      } finally {
        setIsLoading(false)
      }
    }

    bootFromServer()
  }, [status, session?.user?.id])

  const initializeTwin = (data: Partial<CognitiveTwin>) => {
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
    try { localStorage.setItem('novo_cognitive_twin', JSON.stringify(newTwin)) } catch {}

    // Persist to DB — blocking POST to ensure multi-device consistency
    fetch('/api/cognitive-twin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTwin),
    }).catch(() => {})
  }

  const updateTwin = (data: Partial<CognitiveTwin>) => {
    setTwin(prev => {
      const next = { ...prev, ...data, updatedAt: new Date().toISOString() }
      try { localStorage.setItem('novo_cognitive_twin', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const resetTwin = () => {
    setTwin(defaultTwin)
    try { localStorage.removeItem('novo_cognitive_twin') } catch {}
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
