'use client'

import { useEffect, useState } from 'react'
import { Check, CircleAlert, X } from 'lucide-react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import type { NovoActivityPhase } from '@/lib/ai/activity-contract'

/** One stable mapping from server activity phases to the package's visual states. */
export const novoPhaseToOrbState: Partial<Record<NovoActivityPhase, OrbState>> = {
  initializing: 'working',
  retrieving_context: 'searching',
  interpreting_signals: 'solving',
  evaluating_constraints: 'solving',
  prioritizing: 'shaping',
  planning: 'shaping',
  calling_tool: 'working',
  awaiting_confirmation: 'listening',
  executing_action: 'working',
  verifying_result: 'searching',
  learning: 'solving',
  adapting: 'working',
  composing_response: 'composing',
}

type NovoThinkingOrbProps = {
  phase?: NovoActivityPhase | string
  status?: 'active' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'disconnected'
  size?: 'primary' | 'compact'
  label?: string
  className?: string
}

/**
 * Novo-owned adapter around thinking-orbs. It keeps package details out of
 * chat/Loop components and freezes the visual state for terminal runs.
 */
export function NovoThinkingOrb({
  phase,
  status = 'active',
  size = 'compact',
  label,
  className,
}: NovoThinkingOrbProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  useEffect(() => {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    const updateMotion = () => setReducedMotion(media?.matches ?? false)
    updateMotion()
    media?.addEventListener?.('change', updateMotion)
    const root = document.documentElement
    const updatePreference = () => setAnimationsEnabled(root.dataset.animations !== 'false')
    updatePreference()
    const observer = new MutationObserver(updatePreference)
    observer.observe(root, { attributes: true, attributeFilter: ['data-animations'] })
    return () => {
      media?.removeEventListener?.('change', updateMotion)
      observer.disconnect()
    }
  }, [])

  const terminal = status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'expired'
  if (terminal) {
    const icon = status === 'completed'
      ? <Check className="size-3.5 text-emerald-500" aria-hidden />
      : status === 'failed'
        ? <CircleAlert className="size-3.5 text-rose-500" aria-hidden />
        : <X className="size-3.5 text-muted-foreground" aria-hidden />
    return <span className={className} role="img" aria-label={label ?? status}>{icon}</span>
  }

  const orbState = novoPhaseToOrbState[phase as NovoActivityPhase] ?? 'working'
  const orbSize = size === 'primary' ? 64 : 20
  return (
    <span className={className} aria-label={label}>
      <ThinkingOrb
        state={status === 'disconnected' ? 'connecting' : orbState}
        size={orbSize}
        theme="auto"
        paused={reducedMotion || !animationsEnabled}
        aria-label={label}
      />
    </span>
  )
}
