'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export type TrustLevel = 'initial' | 'learning' | 'adapted' | 'validated'

export interface CognitiveTwin {
  userId: string
  updatedAt: string
  version: number
  isInitialized: boolean
  confidenceScore: number // Starts at 42, grows non-linearly with real signals
  trustLevel: TrustLevel  // Derived from confidenceScore

  identity: {
    role: 'student' | 'founder' | 'developer' | 'creator' | 'professional' | ''
    industry: string
    focusStyle: 'deep_builder' | 'reactive_communicator' | 'frantic_juggler' | 'consistent_planner' | ''
    deepWorkCapacity: number // hours, default: 3.5
  }

  energyCurve: {
    chronotype: 'morning_lark' | 'night_owl' | 'afternoon_peak' | ''
    peakFocusStart: string // e.g. '09:00' — inferred by Evolution Engine
    peakFocusEnd: string   // e.g. '12:00'
    typicalSlumpHour: number
  }

  metrics: {
    currentCognitiveLoad: number // 0-100
    decisionFatigueRisk: 'low' | 'moderate' | 'high' | 'critical'
    burnoutIndex: number // 0-100
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
  confidenceScore: 42,
  trustLevel: 'initial',
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

// ── Merge strategy: server wins for inference fields, localStorage wins for workspace preferences ──
function mergeTwins(local: CognitiveTwin, server: Record<string, unknown>): CognitiveTwin {
  return {
    ...local,
    // Server-authoritative fields (Evolution Engine owns these)
    confidenceScore: (server.confidenceScore as number) ?? local.confidenceScore,
    trustLevel: (server.trustLevel as TrustLevel) ?? local.trustLevel,
    isInitialized: (server.isInitialized as boolean) ?? local.isInitialized,
    energyCurve: {
      ...local.energyCurve,
      ...((server.energyCurve as object) ?? {}),
    },
    metrics: {
      ...local.metrics,
      ...((server.metrics as object) ?? {}),
    },
    bottlenecks: {
      ...local.bottlenecks,
      ...((server.bottlenecks as object) ?? {}),
    },
    // Identity from server if local is empty
    identity: (local.identity?.role ? local.identity : ((server.identity as CognitiveTwin['identity']) ?? local.identity)),
    // localStorage wins for workspace layout (user preferences)
    workspaceLayout: local.workspaceLayout,
    updatedAt: new Date().toISOString(),
  }
}

export function CognitiveTwinProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [twin, setTwin] = useState<CognitiveTwin>(defaultTwin)
  const [isLoading, setIsLoading] = useState(true)

  // ── Phase 1: Load from localStorage immediately (no flash) ──────────────
  useEffect(() => {
    try {
      const cached = localStorage.getItem('novo_cognitive_twin')
      if (cached) setTwin(JSON.parse(cached))
    } catch {
      // silently ignore
    }
  }, [])

  // ── Phase 2: Sync with server when authenticated ─────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setIsLoading(false)
      return
    }

    async function syncWithServer() {
      try {
        const res = await fetch('/api/cognitive-twin/sync')
        if (!res.ok) return
        const { twin: serverTwin } = await res.json()
        if (!serverTwin) return

        setTwin(prev => {
          const merged = mergeTwins(prev, serverTwin)
          try { localStorage.setItem('novo_cognitive_twin', JSON.stringify(merged)) } catch {}
          return merged
        })
      } catch {
        // Server sync failed — keep local state, non-critical
      } finally {
        setIsLoading(false)
      }
    }

    syncWithServer()
  }, [status, session?.user?.id])

  const initializeTwin = (data: Partial<CognitiveTwin>) => {
    const newTwin: CognitiveTwin = {
      ...defaultTwin,
      ...data,
      isInitialized: true,
      trustLevel: 'initial',
      updatedAt: new Date().toISOString(),
    }
    setTwin(newTwin)
    try { localStorage.setItem('novo_cognitive_twin', JSON.stringify(newTwin)) } catch {}

    // Persist to DB asynchronously (non-blocking)
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
