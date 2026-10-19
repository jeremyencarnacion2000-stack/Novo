'use client'

import { GlassSurface } from '@/components/ui/GlassSurface'

/** A single optical lens under a black-to-clear tint. The tint and rim are
 * siblings of the lens, so they never isolate its page backdrop. */
export function HubGlassMaterial({ radius = 28, active = true, priority = 'critical' }: {
  radius?: number
  active?: boolean
  priority?: 'critical' | 'interactive'
}) {
  return (
    <div aria-hidden="true" className="novo-hub-material pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit' }}>
      <GlassSurface
        data-hub-glass preset="panel" refractive radius={radius} depth={10} blur={0.8}
        strength={60} chromaticAberration={2} refractivePriority={priority}
        refractiveActive={active} backgroundColor="rgba(0,0,0,0.06)" elevation="low"
        className="novo-hub-lens pointer-events-none"
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}
      />
      <div className="novo-hub-material-tint absolute inset-0" style={{ borderRadius: 'inherit' }} />
      <div className="novo-hub-material-rim absolute inset-0" style={{ borderRadius: 'inherit' }} />
    </div>
  )
}
