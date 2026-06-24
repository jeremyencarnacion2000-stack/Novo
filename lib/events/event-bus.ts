/**
 * event-bus.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized Cognitive Event Bus for Novo.
 * Collects granular user action signals to drive the Behavioral Intelligence Engine.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from 'react'

export type CognitiveEventType =
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'FocusStarted'
  | 'FocusEnded'
  | 'FocusInterrupted'
  | 'CalendarModified'
  | 'GoogleCalendarUpdated'
  | 'HabitCompleted'
  | 'RecommendationAccepted'
  | 'RecommendationDismissed'
  | 'MusicChanged'
  | 'NotificationIgnored'
  | 'SearchPerformed'
  | 'VoiceCommandExecuted'
  | 'IdleDetected'
  | 'ActiveVelocityUpdate' // mouse/keyboard interaction density

export interface CognitiveEvent<T = any> {
  id: string
  type: CognitiveEventType
  timestamp: string // ISO string
  payload: T
  metadata?: {
    path?: string // source page url
    duration?: number // optional session length
    priority?: 'low' | 'medium' | 'high'
  }
}

type EventCallback<T = any> = (event: CognitiveEvent<T>) => void

class CognitiveEventBus {
  private listeners: Map<CognitiveEventType | '*', Set<EventCallback>> = new Map()

  /**
   * Subscribe to a specific event type or all events ('*')
   */
  subscribe<T = any>(type: CognitiveEventType | '*', callback: EventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(callback)

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(type)
      if (typeListeners) {
        typeListeners.delete(callback)
        if (typeListeners.size === 0) {
          this.listeners.delete(type)
        }
      }
    }
  }

  /**
   * Dispatch a new behavioral event to the bus
   */
  dispatch<T = any>(
    type: CognitiveEventType,
    payload: T,
    metadata?: CognitiveEvent['metadata']
  ): CognitiveEvent<T> {
    const event: CognitiveEvent<T> = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata,
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(type)
    if (typeListeners) {
      typeListeners.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error(`[EventBus] Error in subscription handler for ${type}:`, error)
        }
      })
    }

    // Notify global listeners
    const globalListeners = this.listeners.get('*')
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error(`[EventBus] Error in global subscription handler:`, error)
        }
      })
    }

    // If running in the browser, log to global window telemetry log (if active)
    if (typeof window !== 'undefined') {
      const win = window as any
      win.__novo_telemetry = win.__novo_telemetry || []
      win.__novo_telemetry.push(event)
      // Keep last 100 events in memory for real-time local intelligence
      if (win.__novo_telemetry.length > 100) {
        win.__novo_telemetry.shift()
      }
    }

    return event
  }

  /**
   * Fetch current buffered events from browser memory buffer
   */
  getMemoryBuffer(): CognitiveEvent[] {
    if (typeof window !== 'undefined') {
      return (window as any).__novo_telemetry || []
    }
    return []
  }

  /**
   * Clear browser memory buffer
   */
  clearMemoryBuffer(): void {
    if (typeof window !== 'undefined') {
      ;(window as any).__novo_telemetry = []
    }
  }
}

// Global instance
export const eventBus = new CognitiveEventBus()

/**
 * Hook to dispatch events
 */
export function useEmitEvent() {
  return (type: CognitiveEventType, payload: any, metadata?: CognitiveEvent['metadata']) => {
    return eventBus.dispatch(type, payload, metadata)
  }
}

/**
 * Hook to subscribe to events within a React component's lifecycle
 */
export function useEventSubscription<T = any>(
  type: CognitiveEventType | '*',
  callback: (event: CognitiveEvent<T>) => void
) {
  useEffect(() => {
    return eventBus.subscribe(type, callback)
  }, [type, callback])
}
