// Device presence signal: reads completed browser presence sessions
// (hooks/use-device-presence.ts writes these via navigator.sendBeacon to
// app/api/device/presence/route.ts) and flags a long unbroken session.
// Retrospective by design, like every other platform signal in this app —
// a DeviceActivityEvent row only exists once its session has ended, so this
// looks at the most recently *completed* session, not a live/in-progress
// one. Mirrors lib/cognitive/todoist-signal.ts's shape.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

export interface DeviceActivitySample {
  startedAt: Date;
  endedAt: Date;
}

const LONG_SESSION_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function evaluateDevicePresence(
  sessions: DeviceActivitySample[],
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (sessions.length === 0) return results;

  const mostRecent = sessions.reduce((latest, s) =>
    s.endedAt.getTime() > latest.endedAt.getTime() ? s : latest
  );

  const durationMs = mostRecent.endedAt.getTime() - mostRecent.startedAt.getTime();
  if (durationMs >= LONG_SESSION_THRESHOLD_MS) {
    results.push({
      type: 'device_long_session',
      headline: 'Tuviste una sesión de más de 2 horas seguidas en Novo',
      detail: 'Puede valer la pena notar el patrón si se repite seguido.',
      severity: 'info',
    });
  }

  return results;
}
