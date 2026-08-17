/// <reference types="jest" />
import { evaluateDevicePresence, type DeviceActivitySample } from '../device-signal';

describe('evaluateDevicePresence', () => {
  const now = new Date('2026-08-17T18:00:00');

  function session(startOffsetMs: number, durationMs: number): DeviceActivitySample {
    const startedAt = new Date(now.getTime() - startOffsetMs);
    return { startedAt, endedAt: new Date(startedAt.getTime() + durationMs) };
  }

  it('returns no signals for an empty list', () => {
    expect(evaluateDevicePresence([], now)).toEqual([]);
  });

  it('flags the most recent completed session when it exceeds 2 hours', () => {
    const sessions = [session(30 * 60 * 1000, 2.5 * 60 * 60 * 1000)]; // ended 30 min ago, lasted 2.5h
    const result = evaluateDevicePresence(sessions, now);
    const signal = result.find(s => s.type === 'device_long_session');
    expect(signal).toBeDefined();
    expect(signal?.severity).toBe('info');
  });

  it('does not flag a session under 2 hours', () => {
    const sessions = [session(30 * 60 * 1000, 90 * 60 * 1000)]; // 1.5h session
    const result = evaluateDevicePresence(sessions, now);
    expect(result.find(s => s.type === 'device_long_session')).toBeUndefined();
  });

  it('only considers the most recent session, not older long sessions', () => {
    const sessions = [
      session(3 * 24 * 60 * 60 * 1000, 5 * 60 * 60 * 1000), // 3 days ago, 5h (long, but old)
      session(10 * 60 * 1000, 20 * 60 * 1000),               // most recent, only 20 min
    ];
    const result = evaluateDevicePresence(sessions, now);
    expect(result.find(s => s.type === 'device_long_session')).toBeUndefined();
  });

  it('picks the most recent session by endedAt, not array order', () => {
    const older = session(3 * 24 * 60 * 60 * 1000, 30 * 60 * 1000); // 3 days ago, short
    const recent = session(10 * 60 * 1000, 3 * 60 * 60 * 1000);      // most recent, 3h — listed first
    const result = evaluateDevicePresence([recent, older], now);
    expect(result.find(s => s.type === 'device_long_session')).toBeDefined();
  });
});
