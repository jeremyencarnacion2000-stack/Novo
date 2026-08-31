export type ProviderSignalFreshness = 'fresh' | 'stale'

const DEFAULT_PROVIDER_SIGNAL_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function providerSignalFreshness(
  observedAt: Date,
  now = new Date(),
  maxAgeMs = DEFAULT_PROVIDER_SIGNAL_MAX_AGE_MS,
): ProviderSignalFreshness {
  return now.getTime() - observedAt.getTime() <= maxAgeMs ? 'fresh' : 'stale'
}
