const DEFAULT_ANALYTICS_DAYS = 30
const MAX_ANALYTICS_DAYS = 365

/** Keep client-provided windows finite so an invalid query cannot create an
 * Invalid Date (or an unbounded database scan). */
export function normalizeAnalyticsDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_ANALYTICS_DAYS
  return Math.min(MAX_ANALYTICS_DAYS, Math.max(1, Math.floor(parsed)))
}
