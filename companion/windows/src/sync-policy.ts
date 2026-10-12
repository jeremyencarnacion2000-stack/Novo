export type ActivitySyncPolicy = {
  isTauri: boolean;
  syncInFlight: boolean;
  historyClearRequested: boolean;
  tokenPresent: boolean;
  queuedEvents: number;
  online: boolean;
};

export const DEVELOPER_CONTEXT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type DeveloperContextRefreshPolicy = {
  nowMs: number;
  lastAttemptMs: number | null;
  inFlight: boolean;
  force?: boolean;
};

export function shouldRefreshDeveloperContext(policy: DeveloperContextRefreshPolicy): boolean {
  if (policy.inFlight) return false;
  if (policy.force || policy.lastAttemptMs === null) return true;
  // A backwards system-clock adjustment should not strand context refreshes.
  return policy.nowMs < policy.lastAttemptMs
    || policy.nowMs - policy.lastAttemptMs >= DEVELOPER_CONTEXT_REFRESH_INTERVAL_MS;
}

export function shouldStartActivitySync(policy: ActivitySyncPolicy): boolean {
  return policy.isTauri
    && !policy.syncInFlight
    && !policy.historyClearRequested
    && policy.tokenPresent
    && policy.queuedEvents > 0
    && policy.online;
}
