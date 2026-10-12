import { buildActivitySignals, buildDailySummarySignals, calculateObservedActiveSeconds, isCaptureAllowed, normalizeApplicationId } from '../activity'

describe('companion activity privacy primitives', () => {
  it('builds coarse app/day signals without adding overlapping device totals', () => {
    const signals = buildDailySummarySignals([
      { deviceId: 'desktop-a', day: new Date('2026-10-07T00:00:00.000Z'), applicationId: 'code', state: 'active', durationSeconds: 600 },
      { deviceId: 'desktop-a', day: new Date('2026-10-07T00:00:00.000Z'), applicationId: 'browser', state: 'active', durationSeconds: 300 },
      { deviceId: 'desktop-b', day: new Date('2026-10-07T00:00:00.000Z'), applicationId: 'code', state: 'active', durationSeconds: 500 },
      { deviceId: 'desktop-b', day: new Date('2026-10-07T00:00:00.000Z'), applicationId: 'music', state: 'active', durationSeconds: 900 },
      { deviceId: 'desktop-b', day: new Date('2026-10-07T00:00:00.000Z'), applicationId: 'system.idle', state: 'idle', durationSeconds: 3_600 },
    ], new Date('2026-10-08T12:00:00.000Z'))

    expect(signals.map(({ signalType, label }) => [signalType, label])).toEqual([
      ['active_time_daily', 'Active time observed on connected devices: 23 minutes'],
      ['app_usage_daily', 'browser activity observed: 5 minutes'],
      ['app_usage_daily', 'code activity observed: 10 minutes'],
      ['app_usage_daily', 'music activity observed: 15 minutes'],
    ])
    expect(signals.every((signal) => signal.observedAt.toISOString() === '2026-10-07T00:00:00.000Z')).toBe(true)
  })

  it('normalizes an executable name without retaining its extension or case', () => {
    expect(normalizeApplicationId('  Code.EXE  ')).toBe('code')
  })

  it('rejects paths, URLs, and window-like labels instead of trying to sanitize them', () => {
    expect(normalizeApplicationId('C:\\Users\\Angel\\Code.exe')).toBeNull()
    expect(normalizeApplicationId('https://example.com/private')).toBeNull()
    expect(normalizeApplicationId('draft - Novo — Visual Studio Code')).toBeNull()
  })

  it('honors visible pause, consent, and per-app exclusions', () => {
    const preferences = { enabled: true, paused: false, excludedApplications: ['private-browser.exe'] }
    expect(isCaptureAllowed('code.exe', preferences)).toBe(true)
    expect(isCaptureAllowed('private-browser.exe', preferences)).toBe(false)
    expect(isCaptureAllowed('code.exe', { ...preferences, paused: true })).toBe(false)
    expect(isCaptureAllowed('code.exe', { ...preferences, enabled: false })).toBe(false)
  })

  it('does not double-count overlapping active intervals from multiple devices', () => {
    const start = new Date('2026-10-08T10:00:00.000Z')
    const seconds = calculateObservedActiveSeconds([
      { state: 'active', startedAt: start, endedAt: new Date(start.getTime() + 120_000) },
      { state: 'active', startedAt: new Date(start.getTime() + 60_000), endedAt: new Date(start.getTime() + 180_000) },
      { state: 'idle', startedAt: start, endedAt: new Date(start.getTime() + 600_000) },
      { state: 'locked', startedAt: start, endedAt: new Date(start.getTime() + 600_000) },
    ])
    expect(seconds).toBe(180)
  })

  it('creates direct, source-attributed daily signals from intervals without interpreting them', () => {
    const start = new Date('2026-10-08T10:00:00.000Z')
    const signals = buildActivitySignals([
      { applicationId: 'code', state: 'active', startedAt: start, endedAt: new Date(start.getTime() + 120_000) },
      { applicationId: 'code', state: 'active', startedAt: new Date(start.getTime() + 60_000), endedAt: new Date(start.getTime() + 180_000) },
    ])

    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'device', signalType: 'active_time_daily', reliability: 'direct' }),
      expect.objectContaining({ source: 'device', signalType: 'app_usage_daily', reliability: 'direct', label: expect.stringContaining('code') }),
    ]))
    expect(signals.some((signal) => /burnout|procrastination|motivation|focus pattern/i.test(signal.label))).toBe(false)
  })
})
