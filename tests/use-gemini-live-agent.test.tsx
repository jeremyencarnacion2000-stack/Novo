/**
 * @jest-environment jsdom
 *
 * useGeminiLiveAgent – WebSocket Memory Leak & Lifecycle Audit
 * ─────────────────────────────────────────────────────────────
 * ENV vars are auto-injected from .env.test.local via next/jest — no manual setup needed.
 *
 * Verified assertions on unmount:
 *  1. ws.close()  called                     → no dangling socket
 *  2. MediaStream tracks stopped             → mic released
 *  3. addEventListener-style listeners = 0   → true V8 leak surface
 *  4. AudioContext.close() called            → no orphaned audio graph
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useGeminiLiveAgent } from '../hooks/useGeminiLiveAgent'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0))

const waitForCondition = (
  check: () => boolean,
  intervalMs = 20,
  maxMs = 3000
): Promise<void> =>
  new Promise((resolve, reject) => {
    const start = Date.now()
    const handle = setInterval(() => {
      if (check()) {
        clearInterval(handle)
        resolve()
      } else if (Date.now() - start > maxMs) {
        clearInterval(handle)
        reject(new Error(`Condition not met within ${maxMs}ms`))
      }
    }, intervalMs)
    // Prevent the interval from keeping the Node event loop alive after the test
    if (typeof handle === 'object' && 'unref' in handle) (handle as any).unref()
  })

// ─── Mock WebSocket (real async, no fake timers) ──────────────────────────────
class MockWebSocket {
  url: string
  readyState = 0

  onopen: ((...args: any[]) => any) | null = null
  onmessage: ((...args: any[]) => any) | null = null
  onerror: ((...args: any[]) => any) | null = null
  onclose: ((...args: any[]) => any) | null = null

  private _listeners: Record<string, Set<Function>> = {}

  closeCalled = false
  static lastInstance: MockWebSocket | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
    // Use real setTimeout so act() doesn't need fake timers to drain
    setTimeout(() => {
      this.readyState = 1
      if (this.onopen) this.onopen()
    }, 30)
  }

  addEventListener(event: string, cb: Function) {
    if (!this._listeners[event]) this._listeners[event] = new Set()
    this._listeners[event].add(cb)
  }

  removeEventListener(event: string, cb: Function) {
    this._listeners[event]?.delete(cb)
  }

  get addEventListenerCount(): number {
    return Object.values(this._listeners).reduce((sum, s) => sum + s.size, 0)
  }

  close() {
    this.closeCalled = true
    this.readyState = 3
    if (this.onclose) this.onclose()
  }

  send(_: any) {}
}

// ─── Mock AudioContext ────────────────────────────────────────────────────────
const mockTrackStop = jest.fn()
const mockAudioContextClose = jest.fn().mockResolvedValue(undefined)

class MockAudioContext {
  sampleRate = 44100
  currentTime = 0
  destination = {}

  createMediaStreamSource = () => ({ connect: jest.fn(), disconnect: jest.fn() })
  createScriptProcessor = () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null,
  })
  createGain = () => ({ connect: jest.fn(), disconnect: jest.fn(), gain: { value: 1 } })
  createBuffer = () => ({ getChannelData: () => new Float32Array(1024), duration: 0.1 })
  createBufferSource = () => ({
    buffer: null, connect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null,
  })
  close = mockAudioContextClose
}

// ─── Global env setup ─────────────────────────────────────────────────────────
global.WebSocket = MockWebSocket as any
global.AudioContext = MockAudioContext as any
;(global as any).webkitAudioContext = MockAudioContext as any

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    }),
  },
  writable: true,
})

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/player-store', () => ({ usePlayerStore: () => ({}) }))
jest.mock('@/lib/cognitive-context', () => ({ useCognitiveEngine: () => ({ logHabit: jest.fn() }) }))

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('WebSocket Memory Leak & Lifecycle Audit (V8 Engine)', () => {
  beforeEach(() => {
    MockWebSocket.lastInstance = null
    mockTrackStop.mockClear()
    mockAudioContextClose.mockClear()
  })

  test(
    'Should fully teardown (ws.close, mic stop, zero addEventListener leaks, AudioContext closed) upon unmount',
    async () => {
      // ── 1. Mount ──────────────────────────────────────────────────────────
      const { result, unmount } = renderHook(() =>
        useGeminiLiveAgent({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY })
      )

      // ── 2. Start session ──────────────────────────────────────────────────
      // Wrap in act to capture getUserMedia resolution & state updates (setIsRecording)
      await act(async () => {
        result.current.startSession()
        await flushPromises()
      })

      // ── 3. Wait for WebSocket to open (real 30ms timeout) ─────────────────
      await waitForCondition(() => MockWebSocket.lastInstance?.readyState === 1)

      const socket = MockWebSocket.lastInstance!
      expect(socket.readyState).toBe(1)
      expect(socket.closeCalled).toBe(false)

      const preLeak = socket.addEventListenerCount
      console.log(`[V8 Audit] addEventListener listeners ACTIVE: ${preLeak}`)

      // ── 4. Unmount → triggers stopSession cleanup ─────────────────────────
      act(() => { unmount() })
      await flushPromises()

      // ── 5. Assertions ─────────────────────────────────────────────────────
      expect(socket.closeCalled).toBe(true)
      console.log('[V8 Audit] ✅ ws.close() called on unmount')

      expect(socket.readyState).toBe(3)
      console.log('[V8 Audit] ✅ Socket readyState = CLOSED (3)')

      expect(mockTrackStop).toHaveBeenCalled()
      console.log('[V8 Audit] ✅ MediaStream.track.stop() called — mic released')

      expect(mockAudioContextClose).toHaveBeenCalled()
      console.log('[V8 Audit] ✅ AudioContext.close() called — audio graph released')

      const postLeak = socket.addEventListenerCount
      console.log(`[V8 Audit] addEventListener listeners POST-unmount: ${postLeak}`)
      expect(postLeak).toBe(0)
      console.log('[V8 Audit] ✅ Zero addEventListener-style listeners remain — no V8 descriptor leak')
    },
    10_000 // Explicit 10s timeout for this I/O-bound lifecycle test
  )
})
