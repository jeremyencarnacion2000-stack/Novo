// In-memory SSE event bus (single process / development).
//
// Lives outside the route file because Next.js App Router route modules may only
// export HTTP method handlers + a fixed set of config keys — exporting an
// arbitrary helper (pushEventToUser) from app/api/events/route.ts fails the
// build's route-type validation. Both the SSE route (registers clients) and the
// push route (fans events out) import from here so they share one bus instance.
//
// Limitation: without Redis pub/sub, events are per-process. On serverless
// (Vercel) a push only reaches clients connected to the same function instance.
// For multi-instance scale, integrate Pusher, Ably, or Vercel KV.

const clients = new Map<string, Set<ReadableStreamDefaultController>>();

export function addClient(userId: string, controller: ReadableStreamDefaultController) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(controller);
}

export function removeClient(userId: string, controller: ReadableStreamDefaultController) {
  clients.get(userId)?.delete(controller);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

export function pushEventToUser(userId: string, type: string, payload: Record<string, unknown>) {
  const controllers = clients.get(userId);
  if (!controllers) return;
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  controllers.forEach(ctrl => {
    try { ctrl.enqueue(`data: ${data}\n\n`); } catch { /* client disconnected */ }
  });
}
