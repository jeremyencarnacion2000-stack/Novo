import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool as PgPool } from 'pg'
import WebSocket from 'ws'
import { getEffectiveDatabaseUrl } from './database-url'
import { getDatabaseTransport } from './database-transport'

// In Node.js (dev/test/build) the native WebSocket global is absent — we
// need to polyfill it so @neondatabase/serverless can open its WS tunnel.
// On Vercel Edge (and modern browsers) WebSocket is already available globally.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = WebSocket
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = getEffectiveDatabaseUrl()

  if (getDatabaseTransport(connectionString) === 'pg') {
    const pool = new PgPool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter } as any)
  }

  // Create Neon serverless Pool configured for efficient connection reuse
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  const adapter = new PrismaNeon(pool)
  return new PrismaClient({ adapter } as any)
}

// In development & production serverless instances, maintain global singleton
// to prevent pool exhaustion across fast reloads and warm lambda invocations.
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
