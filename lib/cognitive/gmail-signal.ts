// Gmail signal: unread inbox count as a cognitive-load contributor, same
// idea as calendar-signal.ts's meeting-overload check. Gmail was connected
// as a standalone utility (list unread emails in Conectores) with zero
// connection to the Twin - this closes that gap using the same
// PlatformSignal contract every other platform already goes through.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

const UNREAD_OVERLOAD_THRESHOLD = 30;

export function evaluateGmailThresholds(unreadCount: number): PlatformSignal[] {
  if (unreadCount > UNREAD_OVERLOAD_THRESHOLD) {
    return [{
      type: 'gmail_inbox_overload',
      headline: `${unreadCount} correos sin leer`,
      detail: 'Tu bandeja de entrada está sobrecargada — considera un bloque dedicado para procesarla.',
      severity: 'warning',
    }];
  }
  return [];
}
