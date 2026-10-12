import type { CognitiveLens } from './types'

const LENSES = new Set<CognitiveLens>(['now', 'goals', 'patterns', 'memory', 'sources'])
const MIN_LIMIT = 8
const MAX_LIMIT = 35
const MAX_HISTORY_DAYS = 180

export type CognitiveGraphQuery = {
  lens: CognitiveLens
  focusNodeId?: string
  depth: number
  limit: number
  since?: Date
}

/**
 * Parse the public graph controls once at the HTTP boundary.
 *
 * The projection is intentionally bounded even when a client sends arbitrary
 * values. `since` is clamped to a finite history window so an old account (or
 * an accidental `1970-01-01`) cannot turn a focused graph request into an
 * unbounded ledger scan.
 */
export function parseCognitiveGraphQuery(searchParams: URLSearchParams, now = new Date()): CognitiveGraphQuery {
  const requestedLens = searchParams.get('lens') as CognitiveLens | null
  const lens = requestedLens && LENSES.has(requestedLens) ? requestedLens : 'now'

  const rawDepth = Number(searchParams.get('depth') || '2')
  const depth = Number.isFinite(rawDepth) ? Math.max(1, Math.min(Math.trunc(rawDepth), 3)) : 2

  const rawLimit = Number(searchParams.get('limit') || '35')
  const limit = Number.isFinite(rawLimit) ? Math.max(MIN_LIMIT, Math.min(Math.trunc(rawLimit), MAX_LIMIT)) : MAX_LIMIT

  const focus = searchParams.get('focus')?.trim()
  const focusNodeId = focus ? focus.slice(0, 160) : undefined

  const rawSince = searchParams.get('since')
  const parsedSince = rawSince ? Date.parse(rawSince) : Number.NaN
  const minimumSince = now.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000
  const since = Number.isFinite(parsedSince)
    ? new Date(Math.min(now.getTime(), Math.max(parsedSince, minimumSince)))
    : undefined

  return { lens, focusNodeId, depth, limit, since }
}
