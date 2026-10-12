/**
 * A retry key represents one client-side create intent. Modern browsers expose
 * crypto.randomUUID(); the tiny fallback keeps older embedded webviews and
 * test environments functional without turning this into an identity token.
 */
export function createClientIdempotencyKey() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid

  return `intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
