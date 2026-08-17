/**
 * twin-signal.ts
 * Fire-and-forget helper for emitting behavioral signals to the Cognitive Twin engine.
 * Never throws — a signal failure must NEVER block the main API response.
 */

import { after } from 'next/server'
import { processTwinSignalHandler } from '@/lib/inngest/functions/process-twin-signal'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

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

// Inline pass-through for the handler's Inngest `step.run` calls — just runs
// each step immediately (no checkpointing/queue).
const inlineStep = { run: <T>(_name: string, fn: () => Promise<T> | T) => Promise.resolve(fn()) }

export async function emitTwinSignal(payload: SignalPayload): Promise<void> {
  const hour = payload.hour ?? new Date().getHours()
  const data = { ...payload, hour }

  // ponytail: the Cognitive Twin inference runs INLINE here, not through
  // Inngest Cloud — the free tier has no INNGEST_* keys, so inngest.send()
  // silently dropped every signal and the twin never learned in production.
  // `after()` runs it once the HTTP response is flushed (Vercel-safe; a bare
  // fire-and-forget promise gets killed when the serverless fn returns).
  // Ceiling: no cross-request concurrency guard (Inngest had limit:1/user),
  // so two signals landing in the same instant for one user could double-count
  // a single confidence tick — harmless for best-effort learning telemetry.
  // Restore the queue (set INNGEST_* keys + swap this for inngest.send) if it
  // ever needs durable retries.
  const run = () =>
    processTwinSignalHandler({ event: { data }, step: inlineStep })
      .then(() => runAmbientTwinForUser(payload.userId, { trigger: payload.signal === 'task_completed' ? 'task_completed' : payload.signal === 'focus_finished' ? 'focus_completed' : 'task_created' }))
      .catch(() => {})

  try {
    after(run)
  } catch {
    // Not inside a request scope (e.g. a cron/background caller) — run directly.
    void run()
  }
}
