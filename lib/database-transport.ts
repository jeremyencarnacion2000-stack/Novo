export type DatabaseTransport = 'neon' | 'pg'

/**
 * Neon production branches use the serverless WebSocket adapter. A loopback
 * audit database is ordinary PostgreSQL over TCP and must use node-postgres;
 * attempting to open it through the Neon adapter makes valid credentials look
 * invalid because every Prisma query fails inside NextAuth's guarded catch.
 */
export function getDatabaseTransport(databaseUrl: string): DatabaseTransport {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('Invalid DATABASE_URL.')
  }

  const hostname = parsed.hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
    ? 'pg'
    : 'neon'
}
