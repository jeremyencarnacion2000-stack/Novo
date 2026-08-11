type CognitiveTwinSyncPayload = {
  identity?: Record<string, unknown>
  energyCurve?: Record<string, unknown>
  metrics?: Record<string, unknown>
  bottlenecks?: Record<string, unknown>
  workspaceLayout?: Record<string, unknown>
  confidenceScore?: number
  isInitialized?: boolean
  onboardingCompletedAt?: string | null
  longTermGoal?: string
}

/**
 * Returns the only fields accepted by the authenticated Twin persistence API.
 * Server-owned values such as userId, version and trust level never cross this
 * boundary from the browser.
 */
export function toCognitiveTwinSyncPayload(input: object): CognitiveTwinSyncPayload {
  const payload: CognitiveTwinSyncPayload = {}
  const record = input as Record<string, unknown>
  const fields = [
    'identity',
    'energyCurve',
    'metrics',
    'bottlenecks',
    'workspaceLayout',
    'confidenceScore',
    'isInitialized',
    'onboardingCompletedAt',
    'longTermGoal',
  ] as const

  for (const field of fields) {
    if (record[field] !== undefined) {
      Object.assign(payload, { [field]: record[field] })
    }
  }

  return payload
}
