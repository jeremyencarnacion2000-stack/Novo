'use client'
/**
 * use-cognitive-theme.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — UI/UX Adaptation: Cognitive State → CSS Custom Property Bridge.
 *
 * PURPOSE:
 *   The CSS phase classes on <html> handle static, phase-scoped design tokens.
 *   This hook handles the *dynamic* side: values that change continuously
 *   within a phase (attention score, fatigue score, minutes-to-next-phase).
 *
 * MECHANISM:
 *   Subscribes to useCognitiveState() and on every change writes CSS vars
 *   to document.documentElement. These vars power utility classes like
 *   .cognitive-attention-bar and any component that reads --cognitive-attention.
 *
 * PERFORMANCE:
 *   - Does NOT use setInterval — purely reactive to context changes (~60s ticks
 *     + immediate event-driven updates from the EventBus bridge)
 *   - All DOM writes are batched in a single useEffect, touching only the
 *     <html> element's style attribute
 *   - No React re-renders triggered — side-effect only
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from 'react'
import { useCognitiveState } from '@/lib/cognitive-context'

/**
 * Mounts this hook once inside <CognitiveProvider> to keep CSS vars in sync
 * with the live BioState. Returns nothing — pure side-effect.
 */
export function useCognitiveTheme(): void {
  const { bioState, userStressScore } = useCognitiveState()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const html = document.documentElement

    html.style.setProperty('--cognitive-attention',        String(bioState.attentionScore))
    html.style.setProperty('--cognitive-fatigue',          String(bioState.fatigueScore))
    html.style.setProperty('--cognitive-stress',           String(userStressScore))
    html.style.setProperty('--cognitive-minutes-to-next',  String(bioState.minutesToNextPhase))
    html.style.setProperty('--cognitive-ultradian-cycle',  String(bioState.ultradianCycle))

    const secondaryOpacity = Math.max(0.4, bioState.attentionScore / 100).toFixed(2)
    html.style.setProperty('--cognitive-secondary-opacity', secondaryOpacity)

    const PHASE_ACCENTS: Record<string, string> = {
      PEAK_FOCUS:            '#818cf8',
      LINEAR_EXECUTION:      '#38bdf8',
      SYNAPTIC_FATIGUE:      '#fb923c',
      REDUCED_CAPACITY_MODE: '#f472b6',
    }
    html.style.setProperty('--cognitive-accent', PHASE_ACCENTS[bioState.phase] || '#6366f1')

    const overlayOpacity = (bioState.phase === 'PEAK_FOCUS'
      ? 0.08
      : bioState.phase === 'SYNAPTIC_FATIGUE' || bioState.phase === 'REDUCED_CAPACITY_MODE'
        ? 0.04
        : 0.05
    ).toFixed(2)
    html.style.setProperty('--cognitive-bg-overlay-opacity', overlayOpacity)

    const sidebarBrightness = bioState.phase === 'SYNAPTIC_FATIGUE'
      ? '0.92'
      : bioState.phase === 'REDUCED_CAPACITY_MODE'
        ? '0.85'
        : '1.0'
    html.style.setProperty('--sidebar-brightness', sidebarBrightness)

    const animSpeed = bioState.phase === 'PEAK_FOCUS'
      ? '150ms'
      : bioState.phase === 'SYNAPTIC_FATIGUE'
        ? '500ms'
        : bioState.phase === 'REDUCED_CAPACITY_MODE'
          ? '700ms'
          : '300ms'
    html.style.setProperty('--cognitive-transition-speed', animSpeed)

  }, [bioState, userStressScore])
}

/**
 * Returns the current cognitive accent color as a hex string.
 * Useful for imperative canvas/WebGL renderers that can't read CSS vars.
 */
export function useCognitiveAccentHex(): string {
  const { bioState } = useCognitiveState()
  const ACCENT_MAP: Record<string, string> = {
    PEAK_FOCUS:            '#818cf8',
    LINEAR_EXECUTION:      '#38bdf8',
    SYNAPTIC_FATIGUE:      '#fb923c',
    REDUCED_CAPACITY_MODE: '#f472b6',
  }
  return ACCENT_MAP[bioState.phase] ?? '#6366f1'
}
