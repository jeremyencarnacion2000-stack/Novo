import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActivityRun } from '@/lib/ai/activity'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })
  const { runId } = await params
  const url = new URL(request.url)
  let sequence = Math.max(0, Number(url.searchParams.get('after') ?? 0) || 0)
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      try {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (request.signal.aborted) break
          const result = await getActivityRun(session.user.id, runId, sequence)
          if (!result) { send({ error: 'Run not found' }); break }
          for (const event of result.events) {
            if (event.sequence <= sequence) continue
            sequence = event.sequence
            send({ type: 'activity', event })
          }
          send({ type: 'run', run: result.run, sequence })
          if (['completed', 'failed', 'cancelled', 'expired'].includes(result.run.status)) break
          await new Promise((resolve) => setTimeout(resolve, 750))
        }
      } catch {
        send({ error: 'activity_stream_disconnected', recoverable: true, sequence })
      } finally {
        send('[DONE]')
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } })
}
