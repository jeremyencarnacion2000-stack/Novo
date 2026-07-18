import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addClient, removeClient } from '@/lib/events-bus'

// SSE endpoint for real-time Novo events. The shared in-memory bus lives in
// @/lib/events-bus (a route module can't export the pushEventToUser helper).
// The client (RealtimeContext) maintains a persistent SSE connection.
//
// Architecture:
//   User action → API route → inngest.send(event) → Inngest function runs
//   Inngest function → fetch('/api/events/push', { type, userId, payload })
//   SSE stream → client receives event → UI updates optimistically

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
      addClient(userId, controller)

      // Keep-alive ping every 25s to prevent proxy timeouts
      const ping = setInterval(() => {
        try { controller.enqueue(': ping\n\n') } catch { clearInterval(ping) }
      }, 25_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        removeClient(userId, controller)
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
