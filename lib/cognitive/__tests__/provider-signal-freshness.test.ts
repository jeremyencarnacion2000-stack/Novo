/** @jest-environment node */

import { providerSignalFreshness } from '@/lib/cognitive/provider-signal-freshness'

describe('provider signal freshness', () => {
  const now = new Date('2026-08-28T12:00:00.000Z')

  it('marks observations inside the active window as fresh', () => {
    expect(providerSignalFreshness(new Date('2026-08-28T06:00:00.000Z'), now)).toBe('fresh')
  })

  it('marks older observations as stale so they cannot silently drive a new plan', () => {
    expect(providerSignalFreshness(new Date('2026-08-26T12:00:00.000Z'), now)).toBe('stale')
  })
})
