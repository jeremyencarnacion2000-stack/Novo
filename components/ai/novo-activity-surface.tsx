'use client'

import { NovoThinkingPill } from '@/components/ai/novo-thinking-pill'

/**
 * Compatibility entry point for cognitive surfaces that already consume the
 * activity component. The chat and the Novo Loop now share one physical,
 * stream-backed pill instead of maintaining separate SSE implementations.
 */
export function NovoActivitySurface({
  runId,
  onCancel,
}: {
  runId: string | null
  onCancel?: () => void
}) {
  return (
    <NovoThinkingPill
      runId={runId}
      modelLabel={null}
      intent={null}
      fallback={false}
      onCancel={onCancel}
    />
  )
}
