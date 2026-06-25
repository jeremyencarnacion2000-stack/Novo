'use client'
/**
 * cognitive-context.tsx  ─ v2 Performance Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE CHANGE (v2):
 *   Single-context split into TWO independent contexts:
 *
 *   1. CognitiveStateContext  — carries frequently-updating values (bioState,
 *      navigationWarning, userStressScore). Subscribers re-render every ~60s.
 *
 *   2. CognitiveDispatchContext — carries stable callback refs (logHabit,
 *      setChronotype, refresh, clearNavigationWarning). These are memoized with
 *      useCallback and their identity NEVER changes between renders, so any
 *      component that only dispatches will NEVER re-render due to bio-state ticks.
 *
 * BACKWARD COMPAT:
 *   useCognitiveEngine() merges both contexts — existing call-sites work as-is.
 *   New granular hooks (useCognitiveState, useCognitiveDispatch, useAttentionScore,
 *   useCognitivePhase) allow surgical subscriptions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  computeBioState,
  COGNITIVE_PLAYLIST_QUERIES,
  type BioState,
  type Chronotype,
  type HabitEntry,
  type CognitivePhase,
} from '@/lib/cognitive-engine'
import { usePlayerStore } from '@/lib/player-store'
import { eventBus } from '@/lib/events/event-bus'

// ─── Event Bus → Engine energy cost table ────────────────────────────────────
// These calibrated weights translate behavioral signals into attentional depletion.
const EVENT_ENERGY_COSTS = {
  FocusEnded:       0.55,  // A completed deep-work session is cognitively expensive
  FocusInterrupted: 0.25,  // Interruption is costly but less than full session
  HabitCompleted:   0.15,  // Daily habits are moderate-load
  TaskCompleted:    0.10,  // Task completion is low-cost
} as const

// ─── Routes considered "cognitively expensive" ───────────────────────────────
const HEAVY_ROUTES = ['/projects', '/analytics', '/business', '/library']

// ─── CSS class maps ──────────────────────────────────────────────────────────
const PHASE_HTML_CLASSES: Record<CognitivePhase, string> = {
  PEAK_FOCUS:            'cognitive-peak',
  LINEAR_EXECUTION:      'cognitive-linear',
  SYNAPTIC_FATIGUE:      'cognitive-fatigue',
  REDUCED_CAPACITY_MODE: 'cognitive-reduced-capacity',
}

// ─── Context shape: STATE (changes every ~60s) ────────────────────────────────
export interface CognitiveStateValue {
  bioState:           BioState
  chronotype:         Chronotype
  navigationWarning:  string | null
  userStressScore:    number
  phaseOverride:      CognitivePhase | null
}

// ─── Context shape: DISPATCH (stable — never changes identity) ───────────────
export interface CognitiveDispatchValue {
  setChronotype:          (c: Chronotype) => void
  logHabit:               (energyCost: number) => void
  clearNavigationWarning: () => void
  refresh:                () => void
  setPhaseOverride:       (p: CognitivePhase | null) => void
}

// ─── Legacy combined type (backward compat) ──────────────────────────────────
export type CognitiveContextValue = CognitiveStateValue & CognitiveDispatchValue

// ─── Contexts ─────────────────────────────────────────────────────────────────
const CognitiveStateContext    = createContext<CognitiveStateValue | null>(null)
const CognitiveDispatchContext = createContext<CognitiveDispatchValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CognitiveProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { playPlaylist, currentTrack } = usePlayerStore()

  const [chronotype, setChronotype]     = useState<Chronotype>('intermediate')
  const [phaseOverride, setPhaseOverride] = useState<CognitivePhase | null>(null)
  const [habits, setHabits]             = useState<HabitEntry[]>([])
  const [userStressScore, setUserStressScore] = useState<number>(50)
  const [bioState, setBioState]         = useState<BioState>(() =>
    computeBioState({ now: new Date(), chronotype: 'intermediate', userStressScore: 50 })
  )
  const [navigationWarning, setNavigationWarning] = useState<string | null>(null)

  const prevPhaseRef    = useRef<CognitivePhase>(bioState.phase)
  const audioLoadedRef  = useRef<string | null>(null)

  // Restore settings from localStorage on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedChronotype = localStorage.getItem('cognitive:chronotype') as Chronotype | null
      if (savedChronotype) {
        setChronotype(savedChronotype)
      }
      const savedOverride = localStorage.getItem('cognitive:phase-override') as CognitivePhase | null
      if (savedOverride) {
        setPhaseOverride(savedOverride)
      }
    }
  }, [])

  // ── Biometrics polling (every 3 min) ───────────────────────────────────────
  const fetchBiometrics = useCallback(() => {
    fetch('/api/cognitive/biometrics')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.userStressScore === 'number') {
          setUserStressScore(data.userStressScore)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchBiometrics()
    const id = setInterval(fetchBiometrics, 180_000)
    return () => clearInterval(id)
  }, [fetchBiometrics])

  // ── Event Bus → Engine bridge — ref handles (declared early so refresh/logHabit can populate them) ──
  const logHabitRef = useRef<(cost: number) => void>(() => {})
  const refreshRef  = useRef<() => void>(() => {})

  // ── Bio-state computation (every 60s or on dependency change) ─────────────
  const refresh = useCallback(() => {
    let next = computeBioState({

      now: new Date(),
      chronotype,
      completedHabits: habits,
      userStressScore,
    })

    if (phaseOverride) {
      const labelMap: Record<CognitivePhase, string> = {
        PEAK_FOCUS: 'Peak Focus Window (Forced)',
        LINEAR_EXECUTION: 'Execution Mode (Forced)',
        SYNAPTIC_FATIGUE: 'Recovery Required (Forced)',
        REDUCED_CAPACITY_MODE: 'Reduced Capacity Mode (Forced)',
      }
      const recommendedAudioCategoryMap: Record<CognitivePhase, BioState['recommendedAudioCategory']> = {
        PEAK_FOCUS: 'focus',
        LINEAR_EXECUTION: 'none',
        SYNAPTIC_FATIGUE: 'ambient',
        REDUCED_CAPACITY_MODE: 'ambient',
      }
      next = {
        ...next,
        phase: phaseOverride,
        label: labelMap[phaseOverride],
        attentionScore: phaseOverride === 'PEAK_FOCUS' ? 95 : phaseOverride === 'LINEAR_EXECUTION' ? 70 : 20,
        fatigueScore: phaseOverride === 'SYNAPTIC_FATIGUE' ? 85 : phaseOverride === 'REDUCED_CAPACITY_MODE' ? 75 : 15,
        recommendedAudioCategory: recommendedAudioCategoryMap[phaseOverride],
      }
    }

    setBioState(next)
  }, [chronotype, habits, userStressScore, phaseOverride])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Circadian HTML class injection ────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    Object.values(PHASE_HTML_CLASSES).forEach(c => html.classList.remove(c))
    html.classList.add(PHASE_HTML_CLASSES[bioState.phase])
    if (bioState.blueLight) {
      html.classList.add('blue-light-filter')
    } else {
      html.classList.remove('blue-light-filter')
    }
  }, [bioState.phase, bioState.blueLight])

  // ── Phase transition events ────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = bioState.phase

    if (bioState.phase === 'SYNAPTIC_FATIGUE' && prev !== 'SYNAPTIC_FATIGUE') {
      window.dispatchEvent(new CustomEvent('cognitive:fatigue-onset', {
        detail: { fatigueScore: bioState.fatigueScore, label: bioState.label }
      }))
    }
    if (bioState.phase === 'REDUCED_CAPACITY_MODE' && prev !== 'REDUCED_CAPACITY_MODE') {
      window.dispatchEvent(new CustomEvent('cognitive:reduced-capacity-onset', {
        detail: { attentionScore: bioState.attentionScore, userStressScore, label: bioState.label }
      }))
    }
    if (bioState.phase === 'PEAK_FOCUS' && prev !== 'PEAK_FOCUS') {
      window.dispatchEvent(new CustomEvent('cognitive:peak-onset', {
        detail: { attentionScore: bioState.attentionScore }
      }))
    }

    // Always dispatch global event for any bio-state metrics change (e.g. Outfit sync)
    window.dispatchEvent(new CustomEvent('cognitive-state-updated', {
      detail: { bioState }
    }))
  }, [bioState, userStressScore])

  // ── Auto-load binaural playlist on fatigue ────────────────────────────────
  useEffect(() => {
    const category = bioState.recommendedAudioCategory
    if (category === 'none') { audioLoadedRef.current = null; return }
    if (audioLoadedRef.current === category) return
    if (currentTrack) return

    const query = COGNITIVE_PLAYLIST_QUERIES[category]
    if (!query) return

    audioLoadedRef.current = category

    fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&type=video&maxResults=10`)
      .then(r => {
        if (r.status === 401 || r.status === 403) { audioLoadedRef.current = null; return null }
        return r.ok ? r.json() : null
      })
      .then((data: any) => {
        const items: any[] = data?.tracks ?? []
        if (!items.length) return
        const tracks = items.map((t: any) => ({
          id: t.id ?? t.uri,
          uri: t.id ?? t.uri,
          name: t.name ?? t.title ?? 'Focus Track',
          artist: t.artist ?? t.channelTitle ?? 'Ambient',
          image: t.image ?? t.thumbnailUrl,
          duration_ms: 0,
        }))
        playPlaylist({ id: `cognitive-${category}`, name: query, tracks }, 0)
      })
      .catch(() => { audioLoadedRef.current = null })
  }, [bioState.recommendedAudioCategory, currentTrack, playPlaylist])

  // ── Navigation guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (
      bioState.phase === 'SYNAPTIC_FATIGUE' &&
      HEAVY_ROUTES.some(r => pathname.startsWith(r))
    ) {
      const msg =
        `⚠️ Synaptic Fatigue Detected — attention score is ${bioState.attentionScore}%. ` +
        `Complex cognitive work is not recommended now. Consider a ${bioState.minutesToNextPhase}-minute break.`
      setNavigationWarning(msg)
      window.dispatchEvent(new CustomEvent('cognitive:navigation-warning', {
        detail: { route: pathname, message: msg }
      }))
    } else {
      setNavigationWarning(null)
    }
  }, [bioState, pathname])

  // ── Stable dispatch callbacks (identity never changes) ────────────────────
  const setChronotypeWithSave = useCallback((c: Chronotype) => {
    setChronotype(c)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cognitive:chronotype', c)
    }
  }, [])

  const setPhaseOverrideWithSave = useCallback((p: CognitivePhase | null) => {
    setPhaseOverride(p)
    if (typeof window !== 'undefined') {
      if (p) {
        localStorage.setItem('cognitive:phase-override', p)
      } else {
        localStorage.removeItem('cognitive:phase-override')
      }
    }
  }, [])

  const logHabit = useCallback((energyCost: number) => {
    setHabits(prev => [
      ...prev,
      { completedAt: new Date(), energyCost: Math.min(1, Math.max(0, energyCost)) }
    ])
  }, [])

  // ── Event Bus → Engine bridge — wire refs to latest callbacks ───────────────
  useEffect(() => {
    logHabitRef.current = logHabit
    refreshRef.current  = refresh
  })

  useEffect(() => {
    const unsubFocusEnded = eventBus.subscribe('FocusEnded', () => {
      logHabitRef.current(EVENT_ENERGY_COSTS.FocusEnded)
      refreshRef.current()
    })
    const unsubFocusInterrupted = eventBus.subscribe('FocusInterrupted', () => {
      logHabitRef.current(EVENT_ENERGY_COSTS.FocusInterrupted)
      refreshRef.current()
    })
    const unsubHabit = eventBus.subscribe('HabitCompleted', () => {
      logHabitRef.current(EVENT_ENERGY_COSTS.HabitCompleted)
    })
    const unsubTask = eventBus.subscribe('TaskCompleted', () => {
      logHabitRef.current(EVENT_ENERGY_COSTS.TaskCompleted)
    })
    return () => {
      unsubFocusEnded()
      unsubFocusInterrupted()
      unsubHabit()
      unsubTask()
    }
  }, []) // mount-only — refs are always current

  const clearNavigationWarning = useCallback(() => setNavigationWarning(null), [])

  // ── Memoized context values ───────────────────────────────────────────────
  // STATE: new object every 60s tick — only consumed by components that need live data
  const stateValue = useMemo<CognitiveStateValue>(() => ({
    bioState,
    chronotype,
    navigationWarning,
    userStressScore,
    phaseOverride,
  }), [bioState, chronotype, navigationWarning, userStressScore, phaseOverride])

  // DISPATCH: stable object — identity preserved across ALL state ticks
  const dispatchValue = useMemo<CognitiveDispatchValue>(() => ({
    setChronotype: setChronotypeWithSave,
    logHabit,
    clearNavigationWarning,
    refresh,
    setPhaseOverride: setPhaseOverrideWithSave,
  }), [setChronotypeWithSave, logHabit, clearNavigationWarning, refresh, setPhaseOverrideWithSave])

  return (
    <CognitiveDispatchContext.Provider value={dispatchValue}>
      <CognitiveStateContext.Provider value={stateValue}>
        {children}
        {navigationWarning && (
          <FatigueNavigationWarning
            message={navigationWarning}
            onDismiss={clearNavigationWarning}
            attentionScore={bioState.attentionScore}
            minutesToRecover={bioState.minutesToNextPhase}
          />
        )}
      </CognitiveStateContext.Provider>
    </CognitiveDispatchContext.Provider>
  )
}

// ─── Navigation Warning Overlay ──────────────────────────────────────────────
function FatigueNavigationWarning({
  message,
  onDismiss,
  attentionScore,
  minutesToRecover,
}: {
  message: string
  onDismiss: () => void
  attentionScore: number
  minutesToRecover: number
}) {
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full mx-4"
      role="alert"
      style={{ animation: 'novo-panel-in var(--novo-duration) var(--novo-spring) both' }}
    >
      <div
        className="liquid-glass-elevated rounded-2xl px-5 py-4 border"
        style={{
          background: 'rgba(20, 8, 8, 0.88)',
          borderColor: 'rgba(251, 146, 60, 0.20)',
          boxShadow: '0 12px 48px rgba(251,146,60,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center animate-pulse">
              <span className="text-base">🧠</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-400 mb-1 uppercase tracking-widest">
              Synaptic Fatigue Warning
            </p>

            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${attentionScore}%`,
                    background: attentionScore < 25
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #f97316, #eab308)',
                  }}
                />
              </div>
              <span className="text-[10px] text-white/40 tabular-nums">{attentionScore}%</span>
            </div>

            <p className="text-[11px] text-white/60 leading-relaxed">
              Complex cognitive work is inadvisable now.
              Recommended recovery: <span className="text-amber-400 font-semibold">{minutesToRecover} min</span>
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1.5 rounded-xl hover:bg-white/10 transition-colors mt-0.5 text-white/30 hover:text-white/60"
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Granular hooks ───────────────────────────────────────────────────────────

/** Read-only state — re-renders every ~60s with bio-state ticks */
export function useCognitiveState(): CognitiveStateValue {
  const ctx = useContext(CognitiveStateContext)
  if (!ctx) throw new Error('useCognitiveState must be used within <CognitiveProvider>')
  return ctx
}

/** Stable dispatch — NEVER re-renders due to bio-state changes */
export function useCognitiveDispatch(): CognitiveDispatchValue {
  const ctx = useContext(CognitiveDispatchContext)
  if (!ctx) throw new Error('useCognitiveDispatch must be used within <CognitiveProvider>')
  return ctx
}

/** Legacy combined hook — backward compat for existing call-sites */
export function useCognitiveEngine(): CognitiveContextValue {
  return { ...useCognitiveState(), ...useCognitiveDispatch() }
}

// ─── Selector hooks (surgical subscriptions) ──────────────────────────────────

/** true only while in PEAK_FOCUS phase */
export function usePeakFocus(): boolean {
  return useCognitiveState().bioState.phase === 'PEAK_FOCUS'
}

/** true when the system recommends recovery */
export function useSynapticFatigue(): boolean {
  return useCognitiveState().bioState.phase === 'SYNAPTIC_FATIGUE'
}

/** Current attention score (0–100) — subscribe without pulling full bioState */
export function useAttentionScore(): number {
  return useCognitiveState().bioState.attentionScore
}

/** Current cognitive phase string */
export function useCognitivePhase(): CognitivePhase {
  return useCognitiveState().bioState.phase
}
