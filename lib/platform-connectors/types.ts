// Shared contract every platform integration returns through — the rest of
// the app (signal persistence, the Ahora hero, chat context) only ever sees
// PlatformSignal[], never a platform-specific shape. New platforms implement
// PlatformConnector; nothing downstream needs to change when one is added.

export interface PlatformSignal {
  type: string;
  headline: string;
  detail: string;
  severity: 'info' | 'warning';
}

export interface PlatformConnector {
  fetchSignals(userId: string): Promise<PlatformSignal[]>;
}
