/**
 * twin-signal.ts
 * Fire-and-forget helper for emitting behavioral signals to the Cognitive Twin engine.
 * Never throws — a signal failure must NEVER block the main API response.
 */

import { inngest } from '@/lib/inngest/client'

export type SignalType =
  | 'task_created'
  | 'task_completed'
  | 'task_deferred'
  | 'focus_started'
  | 'focus_finished'
  | 'routine_completed'
  | 'routine_skipped'

export interface SignalPayload {
  userId: string
  signal: SignalType
  hour?: number      // 0-23 — inferred automatically if omitted
  duration?: number  // minutes
  quality?: number   // 1-5
  metadata?: Record<string, unknown>
}

export async function emitTwinSignal(payload: SignalPayload): Promise<void> {
  try {
    const hour = payload.hour ?? new Date().getHours()
    await inngest.send({
      name: 'twin.signal',
      data: { ...payload, hour },
    })
  } catch {
    // Intentionally swallowed — twin evolution is best-effort
    // Signals can be replayed from logs if needed in production
  }
}
