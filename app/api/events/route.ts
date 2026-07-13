import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// SSE endpoint for real-time Novo events.
// Inngest jobs and API routes can push events here by calling the /api/events/push endpoint.
// The client (RealtimeContext) maintains a persistent SSE connection.
//
// Architecture:
//   User action → API route → inngest.send(event) → Inngest function runs
//   Inngest function → fetch('/api/events/push', { type, userId, payload })
//   SSE stream → client receives event → UI updates optimistically
//
// Limitation: without Redis pub/sub, events are per-process. On serverless (Vercel),
// a push only reaches clients connected to the same function instance.
// For production multi-instance scale: integrate Pusher, Ably, or Vercel KV.

// In-memory event bus (single process / development)
const clients = new Map<string, Set<ReadableStreamDefaultController>>()

export function pushEventToUser(userId: string, type: string, payload: Record<string, unknown>) {
  const controllers = clients.get(userId)
  if (!controllers) return
  const data = JSON.stringify({ type, payload, timestamp: Date.now() })
  controllers.forEach(ctrl => {
    try { ctrl.enqueue(`data: ${data}\n\n`) } catch { /* client disconnected */ }
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl
      if (!clients.has(userId)) clients.set(userId, new Set())
      clients.get(userId)!.add(controller)

      // Keep-alive ping every 25s to prevent proxy timeouts
      const ping = setInterval(() => {
        try { controller.enqueue(': ping\n\n') } catch { clearInterval(ping) }
      }, 25_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        clients.get(userId)?.delete(controller)
        if (clients.get(userId)?.size === 0) clients.delete(userId)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
