// lib/sync-queue.ts
// Queues failed mutations (POST/PUT/DELETE) when offline and replays them when back online

const QUEUE_KEY = 'novo_sync_queue'
export const SYNC_QUEUE_CHANGE_EVENT = 'novo:sync-queue-change'

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
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(QUEUE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

// Add a request to the queue
export function enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp'>): void {
    const queue = getQueue()
    queue.push({
        ...request,
        id: generateId(),
        timestamp: Date.now(),
    })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    console.log(`[SyncQueue] Queued ${request.method} ${request.url} (${queue.length} pending)`)
    notifyQueueChange()
}

// Remove a single item by id
function dequeue(id: string): void {
    const queue = getQueue().filter((item) => item.id !== id)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    notifyQueueChange()
}

// Clear the entire queue
export function clearQueue(): void {
    localStorage.removeItem(QUEUE_KEY)
    notifyQueueChange()
}

// Replay all queued requests
export async function flushQueue(): Promise<{ success: number; failed: number }> {
    const queue = getQueue()
    if (queue.length === 0) return { success: 0, failed: 0 }

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
                dequeue(item.id)
                success++
                console.log(`[SyncQueue] ✓ ${item.method} ${item.url}`)
            } else {
                // Server error — keep in queue for next retry
                failed++
                console.warn(`[SyncQueue] ✗ ${item.method} ${item.url} (${response.status})`)
            }
        } catch (error) {
            // Network error — still offline, stop flushing
            failed++
            console.warn(`[SyncQueue] ✗ ${item.method} ${item.url} (network error)`)
            break
        }
    }

    console.log(`[SyncQueue] Flush complete: ${success} synced, ${failed} pending`)
    return { success, failed }
}

// Wrap fetch to auto-queue mutations when offline
export function createOfflineFetch() {
    const originalFetch = window.fetch.bind(window)

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

        try {
            const response = await originalFetch(input, init)
            return response
        } catch (error) {
            // Network error — queue the mutation
            if (!navigator.onLine) {
                const headers: Record<string, string> = {}
                if (init?.headers) {
                    if (init.headers instanceof Headers) {
                        init.headers.forEach((value, key) => {
                            headers[key] = value
                        })
                    } else if (typeof init.headers === 'object') {
                        Object.assign(headers, init.headers)
                    }
                }

                let body: string | null = null;
                if (init?.body) {
                    if (typeof init.body === 'string') {
                        body = init.body;
                    } else if (init.body instanceof URLSearchParams) {
                        body = init.body.toString();
                    } else {
                        // For other types like Blob, FormData, etc., we might need more complex logic
                        // but for now we'll mark as null rather than throwing
                        console.warn('[SyncQueue] Unsupported body type for offline queue:', typeof init.body);
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
