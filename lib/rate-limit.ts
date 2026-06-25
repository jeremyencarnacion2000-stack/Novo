const rateMap = new Map<string, { count: number; resetAt: number }>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, val] of rateMap) {
    if (val.resetAt < now) rateMap.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
}

export function rateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000,
): RateLimitResult {
  cleanup()
  const now = Date.now()
  const entry = rateMap.get(key)

  if (!entry || entry.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
  }

  entry.count++
  const remaining = Math.max(0, maxRequests - entry.count)
  const resetIn = entry.resetAt - now

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn }
  }

  return { allowed: true, remaining, resetIn }
}

export function rateLimitResponse(result: RateLimitResult) {
  const { NextResponse } = require('next/server')
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(result.resetIn / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}
