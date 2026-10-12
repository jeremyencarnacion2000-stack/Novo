'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  mergeNovoActivityEvents,
  type NovoActivityEvent,
  type NovoActivityPhase,
} from '@/lib/ai/activity-contract'

export type NovoActivityRun = {
  id: string
  status: string
  sequence: number
  phase: NovoActivityPhase | string
  errorMessage?: string | null
}

const terminalStatuses = new Set(['completed', 'failed', 'cancelled', 'expired'])

export function useNovoActivityRun(runId: string | null) {
  const [events, setEvents] = useState<NovoActivityEvent[]>([])
  const [run, setRun] = useState<NovoActivityRun | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const eventsRef = useRef<NovoActivityEvent[]>([])
  const observedRunIdRef = useRef<string | null>(null)
  const terminalRef = useRef(false)
  const stopPollingRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    if (!runId) {
      observedRunIdRef.current = null
      terminalRef.current = false
      eventsRef.current = []
      setEvents([])
      setRun(null)
      setDisconnected(false)
      return
    }

    // Retrying a live run must not erase its chronology. The source can be
    // recreated after a transient connection failure, while the same run is
    // still useful context for the Twin and for the person watching it.
    const runChanged = observedRunIdRef.current !== runId
    observedRunIdRef.current = runId
    if (runChanged) {
      terminalRef.current = false
      eventsRef.current = []
      setEvents([])
      setRun(null)
      setDisconnected(false)
    }

    let lastSequence = runChanged ? 0 : (eventsRef.current.at(-1)?.sequence ?? 0)
    let hasDisconnected = false
    let pollingTelemetrySent = false
    let active = true
    let source: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    }
    stopPollingRef.current = stopPolling

    const markTerminal = () => {
      terminalRef.current = true
      hasDisconnected = false
      setDisconnected(false)
      stopPolling()
    }

    const markConnected = () => {
      if (terminalRef.current) return
      setDisconnected(false)
      stopPolling()
      if (hasDisconnected) {
        void fetch(`/api/ai/activity/runs/${runId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'telemetry', event: 'reconnected' }),
        }).catch(() => undefined)
        hasDisconnected = false
      }
    }

    const apply = (payload: unknown) => {
      const frame = payload as {
        type?: string
        event?: NovoActivityEvent
        run?: NovoActivityRun
        error?: string
      }
      let receivedFrame = false
      if (frame?.type === 'activity' && frame.event) {
        receivedFrame = true
        lastSequence = Math.max(lastSequence, frame.event.sequence)
        setEvents((current) => {
          const merged = mergeNovoActivityEvents(current, [frame.event!])
          eventsRef.current = merged
          return merged
        })
        if (frame.event.terminal) markTerminal()
      }
      if (frame?.type === 'run' && frame.run) {
        receivedFrame = true
        setRun(frame.run)
        if (terminalStatuses.has(frame.run.status)) markTerminal()
      }
      if (frame?.error === 'activity_stream_disconnected') {
        if (!terminalRef.current) setDisconnected(true)
      } else if (receivedFrame && !terminalRef.current) {
        // A valid frame is the source of truth: it clears a stale reconnecting
        // presentation even if the EventSource implementation never fires
        // `onopen` (which is common in mocked and resumed streams).
        markConnected()
      }
    }

    let connect: () => void
    const recover = async () => {
      try {
        const response = await fetch(`/api/ai/activity/runs/${runId}?after=${lastSequence}`, { cache: 'no-store' })
        if (!active || !response.ok) return
        const payload = await response.json()
        if (!active) return
        for (const event of payload.events ?? []) apply({ type: 'activity', event })
        apply({ type: 'run', run: payload.run })
        if (terminalStatuses.has(payload.run?.status) || terminalRef.current) {
          markTerminal()
          return
        }
        markConnected()
        connect()
      } catch {
        if (active && !terminalRef.current) setDisconnected(true)
      }
    }

    connect = () => {
      if (!active || terminalRef.current) return
      source?.close()
      source = new EventSource(`/api/ai/activity/runs/${runId}/stream?after=${lastSequence}`)
      source.onopen = () => {
        if (active && !terminalRef.current) markConnected()
      }
      source.onmessage = (message) => {
        try {
          apply(JSON.parse(message.data))
        } catch {
          // A malformed transport frame must not erase the last valid state.
        }
      }
      source.onerror = () => {
        if (!active || terminalRef.current) {
          source?.close()
          return
        }
        setDisconnected(true)
        hasDisconnected = true
        source?.close()
        if (!pollTimer) {
          pollTimer = setInterval(recover, 2_000)
          if (!pollingTelemetrySent) {
            pollingTelemetrySent = true
            void fetch(`/api/ai/activity/runs/${runId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'telemetry', event: 'polling_fallback' }),
            }).catch(() => undefined)
          }
        }
        void recover()
      }
    }

    connect()
    return () => {
      active = false
      source?.close()
      stopPolling()
      if (stopPollingRef.current === stopPolling) stopPollingRef.current = null
    }
  }, [runId, connectionAttempt])

  const retry = useCallback(() => {
    if (!runId) return
    void fetch(`/api/ai/activity/runs/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'telemetry', event: 'retry' }),
    }).catch(() => undefined)
    setConnectionAttempt((value) => value + 1)
  }, [runId])

  const cancel = useCallback(async () => {
    if (!runId) return
    const response = await fetch(`/api/ai/activity/runs/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (!response.ok) throw new Error('Unable to cancel activity run')
    const payload = await response.json().catch(() => null)
    if (payload?.run) {
      setRun(payload.run)
      if (terminalStatuses.has(payload.run.status)) {
        terminalRef.current = true
        stopPollingRef.current?.()
        setDisconnected(false)
      }
    }
  }, [runId])

  const current = events.at(-1) ?? null
  const terminal = terminalStatuses.has(run?.status ?? '') || Boolean(current?.terminal)
  const timeline = useMemo(() => events.slice(-8), [events])

  return {
    run,
    events,
    timeline,
    current,
    disconnected,
    terminal,
    retry,
    cancel,
  }
}
