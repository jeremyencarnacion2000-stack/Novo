// lib/sync-queue.ts
// Queues failed mutations (POST/PUT/DELETE) when offline and replays them when back online

const LEGACY_QUEUE_KEY = 'novo_sync_queue'
const QUEUE_KEY_PREFIX = 'novo_sync_queue:'
export const SYNC_QUEUE_CHANGE_EVENT = 'novo:sync-queue-change'

// Offline mutations must never cross an account boundary. The active id is
// set by useSyncQueue only after NextAuth confirms a session. Keeping the
// legacy key as a fallback preserves the small direct utility contract used by
// unit tests and non-authenticated callers that explicitly opt in, while the
// app's installed wrapper always uses the namespaced key.
let activeQueueUserId: string | null = null

export function setSyncQueueUser(userId: string | null): void {
    activeQueueUserId = userId
}

function queueKey(): string {
    return activeQueueUserId ? `${QUEUE_KEY_PREFIX}${activeQueueUserId}` : LEGACY_QUEUE_KEY
}

function readQueue(key: string): QueuedRequest[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function writeQueue(key: string, queue: QueuedRequest[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, JSON.stringify(queue))
}

function safeRequestPath(url: string): string {
    try {
        return new URL(url, 'http://novo.local').pathname
    } catch {
        return '/api/*'
    }
}

function replayHeaders(headers: Headers): Record<string, string> {
    const safe: Record<string, string> = {}
    headers.forEach((value, key) => {
        // Cookies and bearer/API credentials are ambient or short-lived and
        // must never be persisted in localStorage for an offline replay.
        if (['authorization', 'cookie', 'proxy-authorization', 'x-api-key'].includes(key.toLowerCase())) return
        safe[key] = value
    })
    return safe
}

function notifyQueueChange(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SYNC_QUEUE_CHANGE_EVENT))
    }
}

export interface QueuedRequest {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body: string | null
    timestamp: number
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Get all queued requests
export function getQueue(): QueuedRequest[] {
    return readQueue(queueKey())
}

// Add a request to the queue
export function enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp'>): void {
    const queue = getQueue()
    queue.push({
        ...request,
        id: generateId(),
        timestamp: Date.now(),
    })
    localStorage.setItem(queueKey(), JSON.stringify(queue))
    console.log(`[SyncQueue] Queued ${request.method} ${safeRequestPath(request.url)} (${queue.length} pending)`)
    notifyQueueChange()
}

function createRetryKey(): string {
    const uuid = globalThis.crypto?.randomUUID?.()
    return uuid ? `offline-${uuid}` : `offline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

// Remove a single item by id
function dequeue(id: string, key = queueKey()): void {
    const queue = readQueue(key).filter((item) => item.id !== id)
    writeQueue(key, queue)
    notifyQueueChange()
}

// Clear the entire queue
export function clearQueue(): void {
    localStorage.removeItem(queueKey())
    notifyQueueChange()
}

let flushInFlight: Promise<{ success: number; failed: number }> | null = null

// Replay all queued requests
export async function flushQueue(): Promise<{ success: number; failed: number }> {
    // Online/focus events can fire together and multiple app shells can mount
    // during a route transition. Share one flush promise so a mutation is not
    // replayed twice before the first request has been dequeued.
    if (flushInFlight) return flushInFlight

    // Snapshot the namespace before awaiting any request. If the user signs
    // out or switches accounts mid-flush, dequeue must still mutate the queue
    // that was actually sent, never the next account's queue.
    const key = queueKey()
    const queue = readQueue(key)
    if (queue.length === 0) return { success: 0, failed: 0 }

    flushInFlight = (async () => {
      console.log(`[SyncQueue] Flushing ${queue.length} queued requests...`)

      let success = 0
      let failed = 0

      for (const item of queue) {
          try {
              const response = await fetch(item.url, {
                  method: item.method,
                  headers: item.headers,
                  body: item.body,
              })

              if (response.ok || response.status < 500) {
                  // Success or client error (don't retry client errors)
                  dequeue(item.id, key)
                  success++
                  console.log(`[SyncQueue] ✓ ${item.method} ${safeRequestPath(item.url)}`)
              } else {
                  // Server error — keep in queue for next retry
                  failed++
                  console.warn(`[SyncQueue] ✗ ${item.method} ${safeRequestPath(item.url)} (${response.status})`)
              }
          } catch (error) {
              // Network error — still offline, stop flushing
              failed++
              console.warn(`[SyncQueue] ✗ ${item.method} ${safeRequestPath(item.url)} (network error)`)
              break
          }
      }

      console.log(`[SyncQueue] Flush complete: ${success} synced, ${failed} pending`)
      return { success, failed }
    })().finally(() => {
      flushInFlight = null
    })

    return flushInFlight
}

// Wrap fetch to auto-queue mutations when offline
export function createOfflineFetch(options: { allowAnonymousQueue?: boolean } = {}) {
    const originalFetch = window.fetch.bind(window)
    const allowAnonymousQueue = options.allowAnonymousQueue ?? true

    return async function offlineFetch(
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const method = init?.method?.toUpperCase() || 'GET'

        // Only intercept mutations to our API
        if (!url.startsWith('/api/') || method === 'GET') {
            return originalFetch(input, init)
        }

        // A queued request can be delivered after the original response was
        // lost. Give every mutation one stable retry key before the first
        // attempt; endpoints that support durable idempotency will converge
        // instead of inserting a second row during queue replay.
        const requestInit: RequestInit = { ...init }
        const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined)
        new Headers(init?.headers).forEach((value, key) => requestHeaders.set(key, value))
        if (!requestHeaders.has('Idempotency-Key')) {
            requestHeaders.set('Idempotency-Key', createRetryKey())
        }
        requestInit.headers = requestHeaders

        try {
            const response = await originalFetch(input, requestInit)
            return response
        } catch (error) {
            // Network error — queue the mutation
            if (!navigator.onLine && (activeQueueUserId || allowAnonymousQueue)) {
                const headers = replayHeaders(requestHeaders)

                let body: string | null = null;
                if (requestInit.body) {
                    if (typeof requestInit.body === 'string') {
                        body = requestInit.body;
                    } else if (requestInit.body instanceof URLSearchParams) {
                        body = requestInit.body.toString();
                    } else {
                        // For other types like Blob, FormData, etc., we might need more complex logic
                        // but for now we'll mark as null rather than throwing
                        console.warn('[SyncQueue] Unsupported body type for offline queue:', typeof requestInit.body);
                    }
                }

                enqueue({
                    url,
                    method,
                    headers,
                    body,
                })

                // Return a synthetic "queued" response so the UI doesn't break
                return new Response(
                    JSON.stringify({ queued: true, message: 'Saved offline — will sync when connected' }),
                    {
                        status: 202,
                        headers: { 'Content-Type': 'application/json' },
                    }
                )
            }

            throw error
        }
    }
}
