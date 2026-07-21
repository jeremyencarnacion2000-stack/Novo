// Reading signal: whether the user's currently-"reading" book (Novo's own
// Book model - currentPage/status/updatedAt, independent of whether Google
// Books is even connected) has seen recent progress. Books was connected as
// a standalone library view with zero connection to the Twin - this closes
// that gap the same way gmail-signal.ts and calendar-signal.ts do for their
// platforms.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

export interface ReadingBookSample {
  title: string;
  updatedAt: Date;
}

const STALLED_DAYS_THRESHOLD = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Only ever looks at the most recently-touched "reading" book - the one
// that actually reflects current momentum - not every book ever started.
export function evaluateReadingSignal(currentlyReading: ReadingBookSample[], now: Date): PlatformSignal[] {
  if (currentlyReading.length === 0) return [];

  const mostRecent = currentlyReading.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
  const daysSinceProgress = Math.floor((now.getTime() - mostRecent.updatedAt.getTime()) / MS_PER_DAY);

  if (daysSinceProgress >= STALLED_DAYS_THRESHOLD) {
    return [{
      type: 'books_reading_stalled',
      headline: `${daysSinceProgress} días sin avanzar en "${mostRecent.title}"`,
      detail: 'Retomar aunque sea unas páginas mantiene el hábito de lectura.',
      severity: 'info',
    }];
  }

  return [];
}
